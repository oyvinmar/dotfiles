# Check that docker has started else an annoying
# error message is displayed
docker ps &> /dev/null
if [ $? -eq 0 ]; then
  alias docker-rm-all-containers="docker rm $(docker ps -a -q)"
  alias docker-rm-all-images="docker image prune"
fi