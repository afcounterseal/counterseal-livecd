#!/bin/sh

# This shell library is meant to be used with `set -e`.

if [ "$(whoami)" != "root" ]; then
    echo "This library is useless for non-root users. Exiting..." >&2
    exit 1
fi

# Import the TBB_INSTALL and TBB_EXT variables, and
# configure_xulrunner_app_locale().
. /usr/local/lib/tails-shell-library/tor-browser.sh

# Import try_for().
. /usr/local/lib/tails-shell-library/common.sh

# Break down the chroot and kill all of its processes
try_cleanup_browser_chroot () {
    local chroot="${1}"
    local cow="${2}"
    # findmnt sorts submounts so we just have to revert the list to
    # have the proper umount order. We use `tail` to suppress the
    # "TARGET" column header.
    local chroot_mounts="$(
        findmnt --output TARGET --list --submounts "${chroot}" | tail -n+2 | tac
    )"
    for mnt in ${chroot_mounts} "${cow}"; do
        try_for 10 "umount ${mnt} 2>/dev/null" 0.1
    done
    rmdir "${cow}/rw" "${cow}/work" "${cow}" "${chroot}"
}

# Setup a chroot on a clean overlayfs "fork" of the root filesystem.
setup_chroot_for_browser () {
    local chroot="${1}"
    local cow="${2}"

    # FIXME: When LXC matures to the point where it becomes a viable option
    # for creating isolated jails, the chroot can be used as its rootfs.

    local cleanup_cmd="try_cleanup_browser_chroot \"${chroot}\" \"${cow}\""
    trap "${cleanup_cmd}" INT EXIT

    local rootfs_dir
    local rootfs_dirs_path="/lib/live/mount/rootfs"
    local tails_module_path="/lib/live/mount/medium/live/Tails.module"
    local lowerdirs=

    # We have to pay attention to the order we stack the filesystems;
    # newest must be first, and remember that the .module file lists
    # oldest first, newest last.
    while read rootfs_dir; do
        rootfs_dir="${rootfs_dirs_path}/${rootfs_dir}"
        mountpoint -q "${rootfs_dir}" && \
        lowerdirs="${rootfs_dir}:${lowerdirs}"
    done < "${tails_module_path}"
    # Remove the trailing colon
    lowerdirs=${lowerdirs%?}

    mkdir -p "${cow}" "${chroot}" && \
    mount -t tmpfs tmpfs "${cow}" && \
    mkdir "${cow}/rw" "${cow}/work" && \
    mount -t overlay -o "noatime,lowerdir=${lowerdirs},upperdir=${cow}/rw,workdir=${cow}/work" overlay "${chroot}" && \
    chmod 755 "${chroot}" || \
        return 1
}

browser_conf_dir () {
    local browser_name="${1}"
    local browser_user="${2}"
    echo "/home/${browser_user}/.${browser_name}"
}

browser_profile_dir () {
    local conf_dir="$(browser_conf_dir "${@}")"
    echo "${conf_dir}/profile.default"
}

chroot_browser_conf_dir () {
    local chroot="${1}"; shift
    echo "${chroot}/$(browser_conf_dir "${@}")"
}

chroot_browser_profile_dir () {
    local conf_dir="$(chroot_browser_conf_dir "${@}")"
    echo "${conf_dir}/profile.default"
}

set_chroot_browser_permissions () {
    local chroot="${1}"
    local browser_name="${2}"
    local browser_user="${3}"
    local browser_conf="$(chroot_browser_conf_dir "${chroot}" "${browser_name}" "${browser_user}")"
    chown -R "${browser_user}:${browser_user}" "${browser_conf}"
}

configure_chroot_browser_profile () {
    local chroot="${1}" ; shift
    local browser_name="${1}" ; shift
    local browser_user="${1}" ; shift
    local home_page="${1}" ; shift
    # Now $@ is a list of paths (that must be valid after chrooting)
    # to extensions to enable.

    # Prevent sudo from complaining about failing to resolve the 'amnesia' host
    echo "127.0.0.1 localhost amnesia" > "${chroot}/etc/hosts"

    # Create a fresh browser profile for the clearnet user
    local browser_profile="$(chroot_browser_profile_dir "${chroot}" "${browser_name}" "${browser_user}")"
    local browser_ext="${browser_profile}/extensions"
    mkdir -p "${browser_profile}" "${browser_ext}"

    # Select extensions to enable
    local extension
    while [ -n "${*:-}" ]; do
        extension="${1}" ; shift
        if [ "$(basename "${extension}")" = 'red-2.0-an+fx.xpi' ]; then
           ln -s "${extension}" "${browser_ext}"/'{91a24c60-0f27-427c-b9a6-96b71f3984a9}.xpi'
        else
           ln -s "${extension}" "${browser_ext}"
        fi
    done

    # Set preferences
    local browser_prefs="${browser_profile}/user.js"
    local chroot_browser_config="/usr/share/tails/chroot-browsers"
    cat "${chroot_browser_config}/common/prefs.js" \
        "${chroot_browser_config}/${browser_name}/prefs.js" > "${browser_prefs}"

    # Install addonStartup.json.lz4. This is required to enable the red theme.
    cp "${chroot_browser_config}/${browser_name}/addonStartup.json.lz4" \
        "${browser_profile}"

    # Set browser home page to something that explains what's going on
    if [ -n "${home_page:-}" ]; then
        echo 'user_pref("browser.startup.homepage", "'"${home_page}"'");' >> \
            "${browser_prefs}"
    fi

    # Customize the GUI.
    local browser_chrome="${browser_profile}/chrome/userChrome.css"
    mkdir -p "$(dirname "${browser_chrome}")"
    cat "${chroot_browser_config}/common/userChrome.css" \
        "${chroot_browser_config}/${browser_name}/userChrome.css" >> \
            "${browser_chrome}"

    set_chroot_browser_permissions "${chroot}" "${browser_name}" "${browser_user}"
}

set_chroot_browser_locale () {
    local chroot="${1}"
    local browser_name="${2}"
    local browser_user="${3}"
    local locale="${4}"
    local browser_profile="$(chroot_browser_profile_dir "${chroot}" "${browser_name}" "${browser_user}")"
    configure_xulrunner_app_locale "${browser_profile}" "${locale}"
}

set_chroot_browser_name () {
    local chroot="${1}"
    local human_readable_name="${2}"
    local browser_name="${3}"
    local browser_user="${4}"
    local locale="${5}"
    local ext_dir="${chroot}/${TBB_EXT}"
    local browser_profile_ext_dir="$(chroot_browser_profile_dir "${chroot}" "${browser_name}" "${browser_user}")/extensions"

    # Torbutton is installed in the browser's omni.ja and it decides
    # the browser name.
    local pack="${chroot}/${TBB_INSTALL}/omni.ja"
    local tmp="$(mktemp -d)"
    (
       cd "${tmp}"
       7z x -o"${tmp}" "${pack}" chrome/torbutton/locale
       local torbutton_locale_dir="chrome/torbutton/locale/${locale}"
       if [ ! -d "${torbutton_locale_dir}" ]; then
          torbutton_locale_dir="chrome/torbutton/locale/en-US"
       fi
       sed -i "s/<"'!'"ENTITY\s\+brand\(Full\|Short\|Shorter\)Name.*$/<"'!'"ENTITY brand\1Name \"${human_readable_name}\">/" "${torbutton_locale_dir}/brand.dtd"
       7z u -tzip "${pack}" .
    )
    chmod a+r "${pack}"
    rm -Rf "${tmp}"
}

delete_chroot_browser_searchplugins() {
    local chroot="${1}"
    local ext_dir="${chroot}/${TBB_EXT}"

    pack="${chroot}/${TBB_INSTALL}/browser/omni.ja"
    local searchplugins_dir="chrome/browser/search-extensions"
    local searchplugins_list="${searchplugins_dir}/list.json"
    local tmp="$(mktemp -d)"
    (
        cd "${tmp}"
        7z d -tzip "${pack}" "${searchplugins_dir}/*/manifest.json"
        mkdir -p "${searchplugins_dir}"
        echo '{"default": {"visibleDefaultEngines": []}, "experimental-hidden": {"visibleDefaultEngines": []}}' \
             > "${searchplugins_list}"
        7z u -tzip "${pack}" "${searchplugins_list}"
    )
    rm -r "${tmp}"
    chmod a+r "${pack}"
}

# Delete the Tor Browser icons. This prevents a Tor Browser icon being
# shown in the tab of a "New Tab" page.
delete_chroot_browser_icons() {
    local chroot="${1}"
    local ext_dir="${chroot}/${TBB_EXT}"

    pack="${chroot}/${TBB_INSTALL}/browser/omni.ja"
    7z d -tzip "${pack}" "chrome/browser/content/branding/icon*.png"
    chmod a+r "${pack}"
}

delete_chroot_browser_embedded_extensions_in_omni_ja () {
    local chroot="${1}" ; shift
    # Now $@ is a list of extensions to delete.
    local pack="${chroot}/${TBB_INSTALL}/omni.ja"

    local extension
    while [ -n "${*:-}" ]; do
        extension="${1}" ; shift
        7z d -tzip "${pack}" "chrome/torbutton/content/extensions/${extension}"
    done
    chmod a+r "${pack}"
}

configure_chroot_browser () {
    local chroot="${1}" ; shift
    local browser_user="${1}" ; shift
    local browser_name="${1}" ; shift
    local human_readable_name="${1}" ; shift
    local home_page="${1}" ; shift
    # Now $@ is a list of paths (that must be valid after chrooting)
    # to extensions to enable.
    local best_locale="$(guess_best_tor_browser_locale)"

    if ! chroot "${chroot}" id -a "${browser_user}" 2>/dev/null; then
        chroot "${chroot}" addgroup --quiet --gid 1000 "${browser_user}"
        chroot "${chroot}" adduser  --quiet --disabled-password --gecos "" --uid 1000 --gid 1000 "${browser_user}"
    fi
    configure_chroot_browser_profile "${chroot}" "${browser_name}" \
        "${browser_user}" "${home_page}" "${@}"
    set_chroot_browser_locale "${chroot}" "${browser_name}" "${browser_user}" \
        "${best_locale}"
    set_chroot_browser_name "${chroot}" "${human_readable_name}"  \
        "${browser_name}" "${browser_user}" "${best_locale}"
    delete_chroot_browser_searchplugins "${chroot}"
    delete_chroot_browser_icons "${chroot}"
    delete_chroot_browser_embedded_extensions_in_omni_ja "${chroot}" \
        'uBlock0@raymondhill.net' \
        'https-everywhere'
    set_chroot_browser_permissions "${chroot}" "${browser_name}" \
        "${browser_user}"
}

# Start the browser in the chroot
run_browser_in_chroot () {
    local chroot="${1}"
    local browser_name="${2}"
    local chroot_user="${3}"
    local local_user="${4}"
    local wm_class="${5}"
    local profile="$(browser_profile_dir ${browser_name} ${chroot_user})"

    # Here we set up a network namespace, linking it with the host
    # network namespace via two virtual interfaces, and we enable NAT
    # so we can reach the clearnet.
    # XXX: we'll use 10.123.42.0/24 for the two devices, with the hope
    # that nothing else will interfere with this range.
    if [ ! -e /var/run/netns/clearnet ]; then
        ip netns add clearnet
        ip netns exec clearnet ip link set lo up
        ip link add veth-host type veth peer name veth-clearnet
        ip link set veth-clearnet netns clearnet
        ip addr add 10.123.42.1/24 dev veth-host
        ip netns exec clearnet ip addr add 10.123.42.2/24 dev veth-clearnet
        ip link set veth-host up
        ip netns exec clearnet ip link set veth-clearnet up
        ip netns exec clearnet ip route add default via 10.123.42.1
    fi
    # XXX: we could probably lock the iptables rules down more,
    # e.g. DNS + TCP only.
    # XXX: these rules must be made persistent, otherwise NAT will
    # break if an interface is up:ed while the Unsafe Browser is
    # running due to the 00-firewall.sh NetworkManager hook.
    iptables -A FORWARD -i veth-host -j ACCEPT
    iptables -A FORWARD -o veth-host -j ACCEPT
    iptables -t nat -A POSTROUTING -s 10.123.42.2/24 -j MASQUERADE
    sysctl net.ipv4.ip_forward=1

    systemd-nspawn --directory="${chroot}" \
                   --bind=/tmp/.X11-unix \
                   --network-namespace-path=/var/run/netns/clearnet \
                   --user="${chroot_user}" \
                   --setenv=TOR_TRANSPROXY=1 \
                   --setenv=DISPLAY=$DISPLAY \
                   /bin/sh -c \
        ". /usr/local/lib/tails-shell-library/tor-browser.sh && \
         exec_unconfined_firefox --class='${wm_class}' -profile '${profile}'"
}
