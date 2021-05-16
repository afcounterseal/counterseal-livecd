import inspect

from tps.configuration.conflicting_app import ConflictingApp
from tps.configuration.mount import Mount
from tps.configuration.feature import Feature


# XXX: Implement LanguageAndRegion and AdministrationPassword


class PersistentDirectory(Feature):
    Id = "PersistentDirectory"
    Mounts = [Mount("Persistent", "/home/amnesia/Persistent")]
    enabled_by_default = True
    conflicting_apps = []


class BrowserBookmarks(Feature):
    Id = "BrowserBookmarks"
    Mounts = [Mount("bookmarks", "/home/amnesia/.mozilla/firefox/bookmarks")]
    conflicting_apps = [
        ConflictingApp(name="Tor Browser",
                       desktop_id="tor-browser.desktop",
                       process_names=["firefox.real"])
    ]


class NetworkConnections(Feature):
    Id = "NetworkConnections"
    Mounts = [Mount("nm-system-connections",
                    "/etc/NetworkManager/system-connections")]


class AdditionalSoftware(Feature):
    Id = "AdditionalSoftware"
    Mounts = [Mount("apt/cache", "/var/cache/apt/archives"),
              Mount("apt/lists", "/var/lib/apt/lists")]
    conflicting_apps = [
        ConflictingApp(name="apt", process_names=["apt"]),
    ]


class Printers(Feature):
    Id = "Printers"
    Mounts = [Mount("cups-configuration", "/etc/cups")]


class Thunderbird(Feature):
    Id = "Thunderbird"
    Mounts = [Mount("thunderbird", "/home/amnesia/.thunderbird")]
    conflicting_apps = [
        ConflictingApp(name="Thunderbird",
                       desktop_id="thunderbird.desktop",
                       process_names=["thunderbird"])
    ]


class GnuPG(Feature):
    Id = "GnuPG"
    Mounts = [Mount("gnupg", "/home/amnesia/.gnupg")]
    conflicting_apps = [
        ConflictingApp(name = "gpg", process_names=["gpg"]),
    ]


class Electrum(Feature):
    Id = "Electrum"
    Mounts = [Mount("electrum", "/home/amnesia/.electrum")]
    conflicting_apps = [
        ConflictingApp(name="Electrum",
                       desktop_id="electrum.desktop",
                       process_names=["electrum"])
    ]


class Pidgin(Feature):
    Id = "Pidgin"
    Mounts = [Mount("pidgin", "/home/amnesia/.purple")]
    conflicting_apps = [
        ConflictingApp(name="Pidgin",
                       desktop_id="pidgin.desktop",
                       process_names=["pidgin"])
    ]


class SSHClient(Feature):
    Id = "SSHClient"
    Mounts = [Mount("openssh-client", "/home/amnesia/.ssh")]


class Dotfiles(Feature):
    Id = "Dotfiles"
    Mounts = [Mount("dotfiles", "/home/amnesia", uses_symlinks=True)]


def get_classes():
    return [g for g in globals().values() if inspect.isclass(g)
            and Feature in g.__bases__]
