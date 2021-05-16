from abc import abstractmethod

from gi.repository import Gio, GLib

class DBusError(Exception):
    """An exception that can be returned as an error by a D-Bus method"""
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @classmethod
    def is_instance(cls, err) -> bool:
        # noinspection PyArgumentList
        if not Gio.DBusError.is_remote_error(err):
            return False
        # noinspection PyArgumentList
        return Gio.DBusError.get_remote_error(err) == cls.name

    @classmethod
    def strip_remote_error(cls, err: GLib.Error):
        # This function should not be required,
        # Gio.DBusError.strip_remote_error should be used instead, but
        # that's currently broken, see
        # https://gitlab.gnome.org/GNOME/pygobject/-/issues/342
        prefix = f"GDBus.Error:{cls.name}: "
        if err.message.startswith(prefix):
            err.message = err.message[len(prefix):]


class ActivationFailedError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.ActivationFailed"

class AlreadyActivatedError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.AlreadyActivated"

class PersistentStorageNotCreatedError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.PersistentStorageNotCreated"

class NotActivatedError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.NotActivated"

class JobCancelledError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.JobCancelled"

class TargetIsBusyError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.TargetIsBusyError"

class IncorrectOwnerError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.IncorrectOwnerError"

class IncorrectPassphraseError(DBusError):
    name = "org.boum.tails.PersistentStorage.Error.IncorrectPassphraseError"
