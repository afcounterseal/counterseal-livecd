from logging import getLogger
from gi.repository import Gio, GLib, Gtk
from typing import TYPE_CHECKING

from tps.dbus.errors import IncorrectPassphraseError

from tps_frontend import _, CHANGE_PASSPHRASE_DIALOG_UI_FILE
from tps_frontend.passphrase_strength_hint import set_passphrase_strength_hint

if TYPE_CHECKING:
    from tps_frontend.window import Window

logger = getLogger(__name__)

@Gtk.Template.from_file(CHANGE_PASSPHRASE_DIALOG_UI_FILE)
class ChangePassphraseDialog(Gtk.Dialog):
    __gtype_name__ = "ChangePassphraseDialog"

    ok_button = Gtk.Template.Child()  # type: Gtk.Button
    cancel_button = Gtk.Template.Child()  # type: Gtk.Button
    old_passphrase_entry = Gtk.Template.Child()  # type: Gtk.Entry
    verify_entry = Gtk.Template.Child()  # type: Gtk.Entry
    passphrase_entry = Gtk.Template.Child()  # type: Gtk.Entry
    progress_bar = Gtk.Template.Child()  # type: Gtk.ProgressBar
    verify_hint_box = Gtk.Template.Child()  # type: Gtk.Box
    error_infobar = Gtk.Template.Child()  # type: Gtk.InfoBar
    error_infobar_label = Gtk.Template.Child()  # type: Gtk.Label

    def __init__(self, parent: "Window", service_proxy: Gio.DBusProxy,
                 *args, **kwargs):
        super().__init__(use_header_bar=1, *args, **kwargs)
        self.service_proxy = service_proxy
        self.parent = parent

        self.title = _("Change Passphrase")
        self.set_transient_for(self.parent)
        self.set_destroy_with_parent(True)

        self.passphrases_match = False

    def run(self):
        self.old_passphrase_entry.grab_focus()
        self.ok_button.grab_default()
        super().run()

    @Gtk.Template.Callback()
    def on_cancel_button_clicked(self, button: Gtk.Button):
        self.destroy()

    @Gtk.Template.Callback()
    def on_ok_button_clicked(self, button: Gtk.Button):
        # Try to change the passphrase
        parameters = GLib.Variant("(ss)",
                                  (self.old_passphrase_entry.get_text(),
                                   self.passphrase_entry.get_text()))
        try:
            self.service_proxy.call_sync(method_name="ChangePassphrase",
                                         parameters=parameters,
                                         flags=Gio.DBusCallFlags.NONE,
                                         timeout_msec=-1,
                                         cancellable=None)
        except GLib.Error as e:
            logger.error(f"failed to change passphrase: {e.message}")
            if IncorrectPassphraseError.is_instance(e):
                # Show a warning icon in the old passphrase entry
                self.old_passphrase_entry.set_icon_from_stock(
                    Gtk.EntryIconPosition.SECONDARY, "gtk-dialog-warning")
                # Show an error message in an infobar
                msg = _("The current passphrase is incorrect")
                self.error_infobar_label.set_text(msg)
                self.error_infobar.show_all()
                return
            else:
                self.destroy()
                self.parent.display_error(_("Changing the passphrase failed"),
                                          e.message)
                self.response(Gtk.ResponseType.NONE)

        logger.info("Passphrase was changed successfully")
        self.destroy()

    @Gtk.Template.Callback()
    def on_old_passphrase_entry_changed(self, entry: Gtk.Entry):
        # Hide the error infobar (if there is any)
        self.error_infobar.hide()
        # Hide the warning icon (if there is any)
        entry.set_icon_from_icon_name(1, None)
        self.ok_button.set_sensitive(self.passphrases_match and
                                     entry.get_text())

    @Gtk.Template.Callback()
    def on_passphrase_entry_changed(self, entry: Gtk.Entry):
        passphrase = entry.get_text()
        set_passphrase_strength_hint(self.progress_bar, passphrase)
        self.update_passphrase_match()

    @Gtk.Template.Callback()
    def on_verify_entry_changed(self, entry: Gtk.Entry):
        self.update_passphrase_match()

    def update_passphrase_match(self):
        verify = self.verify_entry.get_text()
        if not verify:
            # Don't display anything if the verify entry is empty
            self.verify_hint_box.set_visible(False)
            return

        self.passphrases_match = verify == self.passphrase_entry.get_text()
        self.verify_hint_box.set_visible(not self.passphrases_match)
        self.ok_button.set_sensitive(self.passphrases_match and
                                     self.old_passphrase_entry.get_text())

    @Gtk.Template.Callback()
    def on_show_passphrase_button_toggled(self, button: Gtk.Button):
        is_active = button.get_active()
        self.old_passphrase_entry.set_visibility(is_active)
        self.passphrase_entry.set_visibility(is_active)
        self.verify_entry.set_visibility(is_active)
