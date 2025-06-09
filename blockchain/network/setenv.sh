#!/bin/bash
export FABRIC_CFG_PATH=$PWD
export CORE_PEER_LOCALMSPID="FarmerOrgMSP"
export CORE_PEER_MSPCONFIGPATH="${PWD}/crypto-config/peerOrganizations/farmer.olive.com/users/Admin@farmer.olive.com/msp"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE="${PWD}/crypto-config/peerOrganizations/farmer.olive.com/peers/peer0.farmer.olive.com/tls/ca.crt"
export CORE_PEER_TLS_ENABLED=true