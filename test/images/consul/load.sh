#
# Loads all the metadata into Consul (to be executed after consul has started)
#
sleep 5
curl -X PUT "http://localhost:${CONSULKV_PORT}/v1/kv/dataregistry/url" \
    --data "https://api-dev.aurin.org.au/data_registry"
curl -X PUT "http://localhost:${CONSULKV_PORT}/v1/kv/geoserver/user" \
    --data "admin"
curl -X PUT "http://localhost:${CONSULKV_PORT}/v1/kv/geoserver/password" \
    --data "4hjTOP6dhe"
curl -X PUT "http://localhost:${CONSULKV_PORT}/v1/kv/geoserver/master/user" \
    --data "root"
curl -X PUT "http://localhost:${CONSULKV_PORT}/v1/kv/geoserver/master/password" \
    --data "hHuW\"+4j"
