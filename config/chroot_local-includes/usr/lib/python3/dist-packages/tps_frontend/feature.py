import logging
from gi.repository import Gio, GLib, GObject, Gtk
import os
import re
import psutil
from typing import TYPE_CHECKING, Dict, List, Union

from tps.dbus.errors import TargetIsBusyError, IncorrectOwnerError

from tps_frontend import _, DBUS_SERVICE_NAME, DBUS_FEATURES_PATH, \
    DBUS_FEATURE_INTERFACE, DBUS_JOB_INTERFACE

if TYPE_CHECKING:
    from tps_frontend.window import Window

logger = logging.getLogger(__name__)


class Feature(object):
    @property
    def dbus_object_name(self) -> str:
        """The name of the D-Bus object representing this feature

        By default, the class name is used. Features for which
        the class name does not correspond with the D-Bus object
        can override this property."""
        return self.__class__.__name__

    @property
    def switch_name(self) -> str:
        """The name of the GtkSwitch to turn this feature on/off

        By default, the class name converted to snake_case with
        "_switch" appended is used. Features for which that does
        not correspond with the actual switch name can override
        this property."""
        return camel_to_snake(self.__class__.__name__) + "_switch"

    def __init__(self, window: "Window", builder: Gtk.Builder,
                 bus: Gio.DBusConnection):
        logger.debug(f"Initializing feature {self.__class__.__name__}")
        self.window = window
        self.builder = builder
        self.object_path = os.path.join(DBUS_FEATURES_PATH,
                                        self.dbus_object_name)
        self.proxy = Gio.DBusProxy.new_sync(
            bus, Gio.DBusProxyFlags.NONE, None,
            DBUS_SERVICE_NAME,
            self.object_path,
            DBUS_FEATURE_INTERFACE,
            None,
        )  # type: Gio.DBusProxy

        # Connect to properties-changed signal
        self.proxy.connect("g-properties-changed", self.on_properties_changed)

        self.switch = self.builder.get_object(self.switch_name)
        if not self.switch:
            raise RuntimeError(f"Could not find switch {self.switch_name}")

        # Set the initial switch state
        is_active = self.proxy.get_cached_property("IsActive").get_boolean()
        self.switch.set_state(is_active)
        self.switch.connect("notify::active", self.on_active_changed)
        self.switch.connect("state-set", self.on_state_set)

        self.dialog = None
        self.old_state = None  # type: bool

    def on_state_set(self, switch: Gtk.Switch, state: bool):
        # We return True here to prevent the default handler from
        # running, which would sync the "state" property with the
        # "active" property. We don't want this, because we want to set
        # "state" only to True when the feature was activated
        # successfully.
        # See https://developer.gnome.org/gtk3/stable/GtkSwitch.html#GtkSwitch-state-set
        return True

    def on_active_changed(self, switch: Gtk.Switch, pspec: GObject.ParamSpec):
        is_active = self.proxy.get_cached_property("IsActive").get_boolean()
        if switch.get_active() == is_active:
            # The feature already has the desired state. There are only
            # two cases in which this should happen:
            # * The feature was changed without user interaction,
            #   e.g. activated as a default feature by the backend
            #   after the Persistent Storage was created. In this case
            #   we only have to set the state of the switch accordingly.
            # * If we called set_active ourselves, to flip the switch
            #   back into its old position, because activation of the
            #   feature failed or the user cancelled it. In this case
            #   the switch already has the desired state (setting it
            #   again is a noop).
            switch.set_state(is_active)
            return
        if switch.get_active():
            self.activate()
        else:
            self.deactivate()

    def activate(self):
        logger.debug(f"Activating feature {self.dbus_object_name}")
        # Create a cancellable that can be used to cancel the activation job
        self.cancellable = Gio.Cancellable()
        self.old_state = False

        self.proxy.call(method_name="Activate",
                        parameters=None,
                        flags=Gio.DBusCallFlags.NONE,
                        timeout_msec=GLib.MAXINT,
                        cancellable=self.cancellable,
                        callback=self.on_activate_call_finished)

    def deactivate(self):
        logger.debug(f"Deactivating feature {self.dbus_object_name}")
        # Create a cancellable that can be used to cancel the activation job
        self.cancellable = Gio.Cancellable()
        self.old_state = True

        self.proxy.call(method_name="Deactivate",
                   parameters=None,
                   flags=Gio.DBusCallFlags.NONE,
                   timeout_msec=GLib.MAXINT,
                   cancellable=self.cancellable,
                   callback=self.on_deactivate_call_finished)

    def on_activate_call_finished(self, proxy: Gio.DBusProxy,
                                  res: Gio.AsyncResult):
        if self.dialog:
            self.dialog.destroy()
            self.dialog = None
        try:
            proxy.call_finish(res)
        except GLib.Error as e:
            logger.error(f"failed to activate feature: {e.message}")

            if e.matches(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED):
                # The operation was cancelled by the user, so we cancel
                # the job of the backend.
                self.backend_job.call_sync(method_name="Cancel",
                                           parameters=None,
                                           flags=Gio.DBusCallFlags.NONE,
                                           timeout_msec=-1,
                                           cancellable=None)
            elif IncorrectOwnerError.is_instance(e):
                # Some file created by the user has an invalid owner.
                # This is an expected error which we don't want error
                # reports for.
                IncorrectOwnerError.strip_remote_error(e)
                self.window.display_error(_("Failed to activate feature"),
                                          e.message,
                                          with_send_report_button=False)
            else:
                self.window.display_error(_("Failed to activate feature"),
                                          e.message)

            # Flip the switch back into the inactive position
            self.switch.set_active(False)
            return

        logger.info("Feature successfully activated")

    def on_deactivate_call_finished(self, proxy: Gio.DBusProxy,
                                  res: Gio.AsyncResult):
        if self.dialog:
            self.dialog.destroy()
            self.dialog = None
        try:
            proxy.call_finish(res)
        except GLib.Error as e:
            logger.error(f"failed to deactivate feature: {e.message}")

            if e.matches(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED):
                # The operation was cancelled by the user, so we cancel
                # the job of the backend.
                self.backend_job.call_sync(method_name="Cancel",
                                           parameters=None,
                                           flags=Gio.DBusCallFlags.NONE,
                                           timeout_msec=-1,
                                           cancellable=None)
            elif IncorrectOwnerError.is_instance(e):
                # Some file created by the user has an invalid owner.
                # This is an expected error which we don't want error
                # reports for.
                IncorrectOwnerError.strip_remote_error(e)
                self.window.display_error(_("Failed to activate feature"),
                                          e.message,
                                          with_send_report_button=False)
            elif TargetIsBusyError.is_instance(e):
                # Some process is still accessing the target. This is
                # an expected error which we don't want error reports
                # for.
                TargetIsBusyError.strip_remote_error(e)
                self.window.display_error(_("Failed to deactivate feature"),
                                          e.message,
                                          with_send_report_button=False)
            else:
                self.window.display_error(_("Failed to deactivate feature"),
                                          e.message)

            # Flip the switch back into the active position
            self.switch.set_active(True)
            return

        logger.info("Feature successfully deactivated")

    def on_properties_changed(self, proxy: Gio.DBusProxy,
                              changed_properties: GLib.Variant,
                              invalidated_properties: List[str]):
        logger.debug("changed properties: %s", changed_properties)
        if "IsActive" in changed_properties.keys():
            self.switch.set_active(changed_properties["IsActive"])
            self.switch.set_state(changed_properties["IsActive"])

        if "Job" in changed_properties.keys():
            job_path = changed_properties["Job"]
            # noinspection PyArgumentList
            self.backend_job = Gio.DBusProxy.new_sync(
                connection=proxy.get_connection(),
                flags=Gio.DBusProxyFlags.NONE,
                info=None,
                name=DBUS_SERVICE_NAME,
                object_path=job_path,
                interface_name=DBUS_JOB_INTERFACE,
                cancellable=None,
            )  # type: Gio.DBusProxy

            self.backend_job.connect("g-properties-changed",
                                     self.on_job_properties_changed)

    def on_job_properties_changed(self, proxy: Gio.DBusProxy,
                                  changed_properties: GLib.Variant,
                                  invalidated_properties: List[str]):
        logger.debug("changed job properties: %s", changed_properties)
        if "ConflictingApps" in changed_properties.keys():
            pids = changed_properties["ConflictingApps"]
            self.show_conflicting_apps_message(pids)

    def show_conflicting_apps_message(self, apps: Dict[str, List[int]]):
        msg = self.get_conflicting_apps_message(apps)

        # XXX: Cancellation doesn't seem to work
        self.dialog = Gtk.MessageDialog(self.window,
                                        Gtk.DialogFlags.MODAL | \
                                        Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                        Gtk.MessageType.INFO,
                                        Gtk.ButtonsType.CANCEL,
                                        msg)
        result = self.dialog.run()  # type: Gtk.ResponseType
        if result == Gtk.ResponseType.CANCEL:
            self.dialog.destroy()
            self.cancellable.cancel()
            self.switch.set_active(self.old_state)

    @staticmethod
    def _get_app_for_pid(pid: int) -> Union[Gio.AppInfo, None]:
        try:
            p = psutil.Process(pid)
        except psutil.NoSuchProcess as e:
            logger.warning(e)
            return None
        executable = os.path.basename(p.exe())
        # noinspection PyArgumentList
        apps = Gio.AppInfo.get_all()  # type: List[Gio.AppInfo]
        # We only compare the basenames here because sometimes we
        # replace an application's executable with a wrapper script
        # which exits early and then starts the real executable.
        # In that case, the executable of the running process will be
        # different than the one in the app info. By comparing the
        # basename, we catch those cases in which the wrapper has the
        # same name as the original executable.
        apps_for_pid = [a for a in apps
                        if os.path.basename(a.get_executable()) == executable]
        if len(apps_for_pid) == 0:
            logger.info(f"Found no app for executable {executable}")
            return None
        if len(apps_for_pid) > 1:
            logger.warning(f"Found multiple apps for executable {executable}:"
                           f"{apps_for_pid}")
        return apps_for_pid[0]

    def get_conflicting_apps_message(self, apps: Dict[str, List[int]]):
        # We list each app with the conflicting PIDs. The app names are
        # already translated.
        app_reprs = list()
        for app in apps:
            pids_repr = " ".join(str(pid) for pid in apps[app])
            app_reprs.append(
                # Translators: Don't translate {app} and {pids}, they
                # are placeholders.
                _("{app} ({pids})").format(app=app, pids=pids_repr)
            )

        # Translators: Don't translate {applications}, it's a placeholder
        return _("Close {applications} to continue").format(
            applications=_(" and ").join(app_reprs)
        )

def camel_to_snake(name):
    """From https://stackoverflow.com/a/1176023
    Original authors:
    epost (https://stackoverflow.com/users/129879/epost)
    Zarathustra (https://stackoverflow.com/users/1248724/zarathustra)
    danijar (https://stackoverflow.com/users/1079110/danijar)"""
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()
