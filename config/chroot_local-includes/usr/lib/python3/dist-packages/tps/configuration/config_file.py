from contextlib import contextmanager
from io import TextIOBase
import logging
import os
from pathlib import Path
import shlex
import subprocess
from typing import TYPE_CHECKING, List, Optional
from threading import Lock

from tps.configuration.mount import Mount

if TYPE_CHECKING:
    from tps.configuration.feature import Feature

CONFIG_FILE_NAME="persistence.conf"

logger = logging.getLogger(__name__)


class InvalidStatError(Exception):
    pass


class ConfigFile(object):
    def __init__(self, mount_point: str):
        """The Persistent Storage's config file, which lists the
        directories which should be mounted on startup.

        The format is compatible with the persistence.conf file of
        live-boot(5), except that:
        * Each line must contain a "source" option
        * The only other option that is supported is the "link" option.
          Specifying the default "bind" option explicitly is not
          supported and the "union" option is also unsupported.

        We only support writing the full config file with all
        currently enabled features.
        We can not easily support adding / deleting the lines of a
        a specific feature or list of features, because that would
        cause the config file to be broken if any two features have the
        same mount. In that case, we would not be able to tell which
        feature a specific line in the config file belongs to, so
        it's not clear which lines should be removed on feature
        deactivation.
        """
        self.path = Path(mount_point, CONFIG_FILE_NAME)
        self.backup_path = Path(str(self.path) + ".bak")
        # A lock for ensuring that the config file is not read or
        # written while another method writes to it.
        self.lock = Lock()

    def exists(self) -> bool:
        """Returns whether the config file exists"""
        return self.path.exists()

    def check_file_stat(self):
        """Checks if the config file exists, has the expected type,
        owner, permissions, and ACLs"""
        if not self.path.exists():
            raise InvalidStatError(f"File {self.path} does not exist")

        if self.path.is_symlink():
            raise InvalidStatError(f"File {self.path} is a symbolic link")
        if not self.path.is_file():
            raise InvalidStatError(f"File {self.path} is not a regular file")

        stat = self.path.stat()

        # Check ownership
        if stat.st_uid != os.getuid():
            raise InvalidStatError(f"File {self.path} has UID {stat.st_uid}, "
                                   f"expected {os.getuid()}")
        if stat.st_gid != os.getgid():
            raise InvalidStatError(f"File {self.path} has GID {stat.st_gid}, "
                                   f"expected {os.getgid()}")

        # Check mode. Expected is:
        #  * 0o100000, which means the file is a regular file
        #  * 0o600, which means it's only readable by the owner
        if stat.st_mode != 0o100600:
            raise InvalidStatError(f"File {self.path} has unexpected mode "
                                   f"{stat.st_mode}, expected {oct(0o100600)}")

        # Check ACL
        acl = subprocess.check_output(["getfacl", "--omit-header",
                                       "--skip-base", self.path]).strip()
        if acl:
            raise InvalidStatError(f"File {self.path} has unexpected ACL "
                                   f"{acl}, expected no ACLs.")

    def backup(self):
        with self._open() as source:
           with self._open_backup("w") as dest:
               dest.write(source.read())

    def parse(self) -> List["Mount"]:
        """Parse the config file into mounts"""
        self.lock.acquire()
        try:
            with self._open() as f:
                config_lines = f.readlines()
        finally:
            self.lock.release()

        res = list()
        for line in config_lines:
            mount = self._parse_line(line)
            if mount:
                res.append(mount)

        return res

    def save(self, features: List["Feature"]):
        """Create the config file for the specified list of features"""
        self.lock.acquire()
        logger.debug(f"Saving config file with features: {features}")
        try:
            # Create a backup if the config file exists
            # XXX: This backup doesn't make much sense now that we
            # write to the config file each time a feature is
            # activated / deactivated, because if the user enables at
            # least two features, the backup from his previous session
            # will be gone. We might want to rethink the use cases of
            # the backup and when it makes sense to create it.
            if os.path.exists(self.path):
                self.backup()

            # Get the lines we have to set for the features
            lines = list()
            for feature in features:
                lines += [str(mount) + "\n" for mount in feature.Mounts]

            # Sort and remove duplicate lines
            lines = sorted(set(lines))

            # Write the result back to file
            with self._open("w") as f:
                f.writelines(lines)
        finally:
            self.lock.release()

    def contains(self, feature: "Feature") -> bool:
        """Returns True if the config file contains all mount lines
        of all the specified features, else False."""
        mounts = self.parse()
        return all(mount in mounts for mount in feature.Mounts)

    def disable_and_create_empty(self):
        """Renames the current config file to its filename + .invalid,
        if it exists. Creates a new, empty config file"""
        if self.path.exists():
            self.lock.acquire()
            try:
                self.path.rename(str(self.path) + ".invalid")
            finally:
                self.lock.release()
        self.save([])

    @staticmethod
    def _opener(path, flags):
        # When opening the config file or the backup file, we want
        #   * the file content to be synced to disk on close, and
        #   * the file to be created owner-readable
        fd = os.open(path, flags | os.O_SYNC, mode=0o600)
        # Ensure changes made elsewhere are written synchronously on the disk
        # (in case something else ever needs to modify this file)
        subprocess.check_call(["chattr", "+S", path])
        return fd

    @contextmanager
    def _open(self, *args, **kwargs) -> TextIOBase:
        with open(self.path, *args, **kwargs, opener=self._opener) as f:
            yield f

    @contextmanager
    def _open_backup(self, *args, **kwargs):
        with open(self.backup_path, *args, **kwargs, opener=self._opener) as f:
            yield f

    @staticmethod
    def _parse_line(line: str) -> Optional["Mount"]:
        dest, src = "", ""
        is_file = False
        uses_symlinks = False

        # Get the white-space separated elements of the config line
        elements = shlex.split(line, comments=True)
        if len(elements) != 2:
            # The line has an invalid number of white-space
            # separated elements
            logger.warning("Ignoring invalid config line: %r", line)
            return

        dest = elements[0]
        options = elements[1].split(',')

        # Parse the options
        for option in options:
            if option.startswith("source="):
                src = option[7:]
            elif option == "link":
                uses_symlinks = True
            elif option == "file":
                is_file = True
            else:
                logger.warning("Ignoring config line with invalid option "
                               "%r: %r", option, line)
                return

        if not src:
            logger.warning("Ignoring config line without source: %r", line)
            return

        # Create and return the Mount object
        return Mount(src, dest, is_file, uses_symlinks)
