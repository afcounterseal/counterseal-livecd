#!/bin/sh

curl https://ai-fi.net/apps/livecd/Counterseal.zip -o Counterseal.zip
unzip Counterseal.zip -d counterseal-electron-tmp/
mv counterseal-electron-tmp/Counterseal/* config/chroot_local-includes/usr/local/ai-fi.net/Counterseal/
sudo chmod 4755 config/chroot_local-includes/usr/local/ai-fi.net/Counterseal/Counterseal
rm -rf Counterseal.zip counterseal-electron-tmp

git add config/chroot_local-includes/usr/local/ai-fi.net/Counterseal/
git commit -m "Update Counterseal" .


# mv  -r counterseal-electron-tmp/Counterseal/* co