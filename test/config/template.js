/**
 * Template to create a Docker Swarm cluster
 */

const path = require('path');
const fs = require('fs');
const _ = require('underscore');

const jsonFileImport = require('json-file-import');
const heatConfig = jsonFileImport.load(path.join(__dirname,
  'heat.json'));
const openstackConfig = jsonFileImport.load(path.join(__dirname,
  'openstack.json'));
const secretsConfig = jsonFileImport.load(path.join(__dirname,
  'secrets.json'));
const config = {heat: heatConfig, openstack: openstackConfig, secrets: secretsConfig};
const ipRange = (startIp, count, subnet) => {
  const t = startIp.split('.');
  const s = Number(t[3]);
  const a = [];
  for (let i = 0; i < count; i++) {
    const ip = `${t[0]}.${t[1]}.${t[2]}`;
    a.push({
        subnet_id: {
          get_resource: `${subnet}`
        }
//        ,
//        ip_address: `${ip}.${i + s}`
      }
    );
  }
  return a;
};

const template = {
  heat_template_version: config.openstack.heat.version,
  description: 'Simple template to deploy a single compute instance',
  resources: {
    docker_master: {
      type: 'OS::Nova::Server',
      properties: {
        key_name: config.secrets.keypair,
        image: '90be8b7a-a658-4b48-b8a9-94088cbe1094',
        flavor: 'm2.small',
        networks: [
          {
            port: {
              get_resource: 'swarm_master_port'
            }
          }
        ]
      }
    },
    docker_worker: {
      type: 'OS::Heat::ResourceGroup',
      properties: {
        count: config.openstack.cluster['workers-count'],
        resource_def: {
          type: 'OS::Nova::Server',
          properties: {
            key_name: config.secrets.keypair,
            image: '90be8b7a-a658-4b48-b8a9-94088cbe1094',
            flavor: 'm2.small',
            networks: [
              {
                port: {
                  get_resource: 'swarm_worker_port'
                }
              }
            ]
          }
        }
      }
    },
    swarm_network: {
      type: 'OS::Neutron::Net'
    },
    swarm_subnet: {
      type: 'OS::Neutron::Subnet',
      properties: {
        network: {
          get_resource: 'swarm_network'
        },
        dns_nameservers: config.openstack.cluster.nameservers,
        cidr: config.openstack.cluster['subnet-cidr'],
        gateway_ip: config.openstack.cluster['gateway-ip'],
        allocation_pools: [
          {
            start: config.openstack.cluster['worker-ip'].start,
            end: config.openstack.cluster['worker-ip'].end
          }]
      }
    },
    swarm_router: {
      type: 'OS::Neutron::Router',
      properties: {
        external_gateway_info: {
          network: config.secrets['os-network']
        }
      }
    },
    swarm_router_interface: {
      type: 'OS::Neutron::RouterInterface',
      properties: {
        router_id: {
          get_resource: 'swarm_router'
        },
        subnet_id: {
          get_resource: 'swarm_subnet'
        }
      }
    },
    swarm_master_port: {
      type: 'OS::Neutron::Port',
      properties: {
        network_id: {
          get_resource: 'swarm_network'
        },
        fixed_ips: config.openstack['cluster.master-ip'],
        security_groups: [
          'default',
          {
            get_resource: 'master_securitygroup'
          },
          {
            get_resource: 'swarm_securitygroup'
          }
        ]
      }
    },
    swarm_worker_port: {
      type: 'OS::Neutron::Port',
      properties: {
        network_id: {
          get_resource: 'swarm_network'
        },
        fixed_ips:
          [{
            subnet_id: {
              get_resource: 'swarm_subnet'
            }
          }],
//            ipRange(config.openstack.cluster['worker-ip-start'], config.openstack.cluster['workers-count'], 'swarm_subnet'),
        security_groups: [
          'default',
          {
            get_resource: 'swarm_securitygroup'
          }
        ]
      }
    },
    docker_floating_ip: {
      type: 'OS::Neutron::FloatingIP',
      depends_on: 'swarm_router_interface',
      properties: {
        floating_network_id: config.secrets["os-network"],
        port_id: {
          get_resource: 'swarm_master_port'
        }
      }
    },
    master_securitygroup: {
      type: 'OS::Neutron::SecurityGroup',
      properties:
        {
          rules: [
            {
              remote_ip_prefix: '0.0.0.0/0',
              protocol: 'icmp'
            },
            {
              remote_ip_prefix: '0.0.0.0/0',
              protocol: 'tcp',
              port_range_min: 2377,
              port_range_max: 2377
            }
          ]
        }
    }
    ,
    swarm_securitygroup: {
      type: 'OS::Neutron::SecurityGroup',
      properties:
        {
          rules: [
            {
              remote_ip_prefix: '0.0.0.0/0',
              protocol: 'icmp'
            },
            {
              remote_ip_prefix: config.openstack['cluster.subnet-cidr'],
              protocol: 'tcp',
              port_range_min: 1,
              port_range_max: 65535
            },
            {
              remote_ip_prefix: config.openstack['cluster.subnet-cidr'],
              protocol: 'udp',
              port_range_min: 1,
              port_range_max: 65535
            }
          ]
        }
    }
  }
};

console.log(JSON.stringify(template, null, 2));