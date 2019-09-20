sudo apt update
sudo add-apt-repository ppa:certbot/certbot
sudo apt install nginx python-certbot-nginx

sudo curl -fsSL https://raw.githubusercontent.com/oyvinmar/dotfiles/master/conf/setup/nginx.conf > /etc/nginx/sites-available/default

sudo certbot --nginx -d dev.example.com, example.com
sudo systemctl reload nginx