import abc
from contextlib import contextmanager
from logging import getLogger
import os
import threading
from typing import Dict, List, Optional

from gi.repository import Gio, GLib

from tps import DBUS_JOBS_PATH, DBUS_JOB_INTERFACE
from tps.dbus.object import DBusObject

logger = getLogger(__name__)

job_id = 0
job_id_lock = threading.Lock()


class ServiceUsingJobs(object, metaclass=abc.ABCMeta):
    def __init__(self, *args, connection: Gio.DBusConnection, **kwargs):
        # Make sure that all __init__ functions are called if this
        # class is used with multiple inheritance
        super().__init__(*args, **kwargs)
        self.connection = connection
        self._job = None  # type: Optional[Job]
        # Lock used to prevent race conditions when changing the job attribute
        self.job_lock = threading.Lock()

    @contextmanager
    def new_job(self):
        """Create a new job and set the self.Job attribute to it. Note
        that we assume here that we have a self.Job attribute which we
        did not define ourselves, but which should be defined by the
        subclass"""
        with Job(self.connection) as job:
            with self.job_lock:
                self.Job = job
            try:
                yield job
            finally:
                with self.job_lock:
                    # Set the job to None if no other job was set already
                    if self._job == job:
                        self.Job = None


class Job(DBusObject):
    """A job that can be cancelled. The job might be blocked by
    conflicting processes, in which case the ConflictingProcesses
    property should be set by the owner of the job."""

    dbus_info = '''
    <node>
        <interface name='org.boum.tails.PersistentStorage.Job'>
            <method name='Cancel'/>
            <property name="Id" type="u" access="read"/>
            <property name="ConflictingApps" type="a{sau}" access="read"/>
            <property name="Status" type="s" access="read"/>
            <property name="Progress" type="u" access="read"/>
        </interface>
    </node>
    '''

    @property
    def dbus_path(self):
        return os.path.join(DBUS_JOBS_PATH, str(self.Id))

    def __init__(self, connection: Gio.DBusConnection):
        super().__init__()

        # Set the job ID
        global job_id
        job_id_lock.acquire()
        job_id += 1
        self.Id = job_id
        job_id_lock.release()

        logger.debug("Initializing job %r", self.Id)
        self.connection = connection

        self.cancellable = Gio.Cancellable()  # type: Gio.Cancellable
        self._conflicting_apps = dict()  # type: Dict[str, List[int]]
        self._progress = int()
        self._status = str()

    def __enter__(self):
        self.register(self.connection)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.unregister(self.connection)

    # ----- Exported functions ----- #

    def Cancel(self):
        """Cancel the job"""
        logger.info(f"Cancelling job {self.Id}")
        self.cancellable.cancel()

    # ----- Exported properties ----- #

    @property
    def Status(self) -> str:
        return self._status

    @Status.setter
    def Status(self, status: str):
        if self._status == status:
            # Nothing to do
            return
        self._status = status
        changed_properties = {"Status": GLib.Variant("s", status)}
        self.emit_properties_changed_signal(
            self.connection,
            DBUS_JOB_INTERFACE,
            changed_properties,
        )

    @property
    def Progress(self) -> int:
        return self._progress

    @Progress.setter
    def Progress(self, progress: int):
        if self._progress == progress:
            # Nothing to do
            return
        self._progress = progress
        changed_properties = {"Progress": GLib.Variant("u", progress)}
        self.emit_properties_changed_signal(
            self.connection,
            DBUS_JOB_INTERFACE,
            changed_properties,
        )

    @property
    def ConflictingApps(self) -> Dict[str, List[int]]:
        """A mapping from application name to a list of PIDs which have
        to be terminated before the job can continue"""
        return self._conflicting_apps

    @ConflictingApps.setter
    def ConflictingApps(self, apps: Dict[str, List[int]]):
        if self._conflicting_apps == apps:
            # Nothing to do
            return
        self._conflicting_apps = apps
        variant = GLib.Variant("a{sau}", apps)
        changed_properties = {"ConflictingApps": variant}
        self.emit_properties_changed_signal(
            self.connection,
            DBUS_JOB_INTERFACE,
            changed_properties,
        )
