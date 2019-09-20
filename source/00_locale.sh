is_ubuntu || return 1

# Need to source locale if UsePAM is disabled in sshd_config
source /etc/default/locale