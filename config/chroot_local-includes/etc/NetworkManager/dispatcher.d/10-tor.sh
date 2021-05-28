#!/bin/sh

# We don't start Tor automatically so *this* is the time
# when it is supposed to start.

# Run only when the interface is not "lo":
if [ -z "$1" ] || [ "$1" = "lo" ]; then
    exit 0
fi

if [ "$2" = "up" ]; then
    : # go on, that's what this script is for
elif [ "${2}" = "down" ]; then
    systemctl --no-block stop tails-tor-has-bootstrapped.target
    exit 0
else
    exit 0
fi

# Import tor_control_setconf(), TOR_LOG
. /usr/local/lib/tails-shell-library/tor.sh

systemctl start tor@default.service
/usr/local/sbin/tails-tor-launcher &

# Wait until the user has done the Tor Launcher configuration.
until [ "$(tor_control_getconf DisableNetwork)" = 0 ]; do
    sleep 1
done

# XXX: It seems tor is most reliable at successfully bootstrapping if
# it is freshly restarted, so we abort the bootstrap it just started
# when DisableNetwork became 0 and start a new one. Now that's an
# interesting network fingerprint!
systemctl stop tor@default.service
# We depend on grepping stuff from the Tor log (especially for
# tordate/20-time.sh), so deleting it seems like a Good Thing(TM).
rm -f "${TOR_LOG}"
systemctl start tor@default.service
