from abc import abstractmethod, ABCMeta
import inspect
from logging import getLogger
from typing import Any, Dict, List
from threading import Thread

from gi.repository import Gio, GLib

from tps.dbus.errors import DBusError

logger = getLogger(__name__)


class RegistrationFailedError(Exception):
    pass


class UnregistrationFailedError(Exception):
    pass


class DBusObject(object, metaclass=ABCMeta):
    """DBusObject is an abstract class which facilitates registering
    D-Bus objects"""

    @property
    @abstractmethod
    def dbus_info(self) -> str:
        pass

    @property
    @abstractmethod
    def dbus_path(self) -> str:
        pass

    def __init__(self, *args, **kwargs):
        # Make sure that all __init__ functions are called if this
        # class is used with multiple inheritance
        super().__init__(*args, **kwargs)
        # noinspection PyArgumentList
        self.node_info = Gio.DBusNodeInfo.new_for_xml(self.dbus_info)
        self.reg_ids = list()
        self.registered = False
        self.signals = dict()

        for interface in self.node_info.interfaces:
            for signal in interface.signals:
                args = {arg.name: arg.signature for arg in signal.args}
                self.signals[signal.name] = {
                    'interface': interface.name, 'args': args}

    def register(self, connection: Gio.DBusConnection):
        logger.debug("Registering %r", self.dbus_path)

        for interface in self.node_info.interfaces:
            reg_id = connection.register_object(self.dbus_path,
                                                interface,
                                                self.handle_method_call,
                                                self.handle_get_property,
                                                self.handle_set_property)
            if not reg_id:
                raise RegistrationFailedError(
                    f"Failed to register interface {interface} of object {self}"
                )

            self.reg_ids.append(reg_id)

        self.registered = True

    def unregister(self, connection: Gio.DBusConnection):
        logger.debug("Unregistering %r", self.dbus_path)
        for reg_id in self.reg_ids:
            unregistered = connection.unregister_object(reg_id)
            if not unregistered:
                raise UnregistrationFailedError("Failed to unregister object %r" % self)
        self.reg_ids = list()
        self.registered = False

    def emit_signal(self, connection: Gio.DBusConnection,
                    signal_name: str,
                    values: Dict[str, Any]):
        if self.signals is None:
            return

        signal = self.signals[signal_name]
        parameters = []
        for arg_name, arg_signature in signal['args'].items():
            value = values[arg_name]
            parameters.append(GLib.Variant(arg_signature, value))

        variant = GLib.Variant.new_tuple(*parameters)
        connection.emit_signal(
            None, self.dbus_path, signal['interface'], signal_name, variant,
        )

    def emit_properties_changed_signal(self, connection: Gio.DBusConnection,
                                       interface_name: str,
                                       changed_properties: Dict[str, GLib.Variant],
                                       invalidated_properties: List[str] = None):
            if invalidated_properties is None:
                invalidated_properties = list()

            parameters = GLib.Variant.new_tuple(
                GLib.Variant("s", interface_name),
                GLib.Variant("a{sv}", changed_properties),
                GLib.Variant("as", invalidated_properties)
            )
            connection.emit_signal(
                None, self.dbus_path, "org.freedesktop.DBus.Properties",
                'PropertiesChanged', parameters
            )

    def handle_method_call(self, *args, **kwargs) -> None:
        thread = Thread(target=self.do_handle_method_call, args=args,
                        kwargs=kwargs, daemon=True)
        thread.start()

    def do_handle_method_call(self,
                              connection: Gio.DBusConnection,
                              sender: str,
                              object_path: str,
                              interface_name: str,
                              method_name: str,
                              parameters: GLib.Variant,
                              invocation: Gio.DBusMethodInvocation) -> None:

        try:
            logger.debug("Handling method call %s.%s%s", self.__class__.__name__, method_name, parameters)
            method_info = self.node_info.lookup_interface(interface_name).lookup_method(method_name)

            # If the method has a special handler function, then call that.
            try:
                handler = getattr(self, method_name + "_method_call_handler")
                handler(connection, parameters, invocation)
                return
            except AttributeError:
                # The method does not have a special handler function,
                # so we handle it here.
                pass

            func = getattr(self, method_name)
            result = func(*parameters)

            if not method_info.out_args:
                invocation.return_value(None)
                return

            if len(method_info.out_args) == 1:
                result = (result,)

            return_signature = "(%s)" % "".join(arg.signature for arg in method_info.out_args)
            invocation.return_value(GLib.Variant(return_signature, result))
        except DBusError as e:
            logger.exception(e)
            invocation.return_dbus_error(e.name, str(e))
        except Exception as e:
            logger.exception(e)
            module = inspect.getmodule(e)
            if module:
                error_name = module.__name__ + "." + type(e).__name__
            else:
                error_name = type(e).__name__
            if e.__class__.__module__ == "__builtin__":
                error_name = "builtin." + error_name
            if not Gio.dbus_is_name(error_name):
                logger.warning(f"Error name {error_name} is not a valid D-Bus name")
                error_name = "python.UnknownError"
            invocation.return_dbus_error(error_name, str(e))

    def handle_get_property(self,
                            connection: Gio.DBusConnection,
                            sender: str,
                            object_path: str,
                            interface_name: str,
                            property_name: str) -> GLib.Variant:
        logger.debug("Handling property read of %s.%s", object_path, property_name)
        try:
            interface_info = self.node_info.lookup_interface(interface_name)
            property_info = interface_info.lookup_property(property_name)
            value = getattr(self, property_name)

            logger.debug("Converting value %r to Variant type %r", value, property_info.signature)
            return GLib.Variant(property_info.signature, value)
        except Exception as e:
            logger.exception(e)

    def handle_set_property(self,
                            connection: Gio.DBusConnection,
                            sender: str,
                            object_path: str,
                            interface_name: str,
                            property_name: str,
                            value: GLib.Variant) -> bool:
        logger.debug("Handling property write of %s.%s", object_path, property_name)
        setattr(self, property_name, value.unpack())
        return True
