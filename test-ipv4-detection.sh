#!/bin/bash

# Script de test pour la détection IPv4
echo "Test de détection IPv4..."
echo "========================"

echo -e "\n1. curl -4 ifconfig.me :"
curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || echo "Échec"

echo -e "\n\n2. curl -4 ipinfo.io/ip :"
curl -4 -s --max-time 5 ipinfo.io/ip 2>/dev/null || echo "Échec"

echo -e "\n\n3. curl -4 checkip.amazonaws.com :"
curl -4 -s --max-time 5 checkip.amazonaws.com 2>/dev/null || echo "Échec"

echo -e "\n\n4. curl -4 api.ipify.org :"
curl -4 -s --max-time 5 api.ipify.org 2>/dev/null || echo "Échec"

echo -e "\n\n5. curl -4 ipv4.icanhazip.com :"
curl -4 -s --max-time 5 ipv4.icanhazip.com 2>/dev/null || echo "Échec"

echo -e "\n\n6. wget -4 -qO- ipv4.icanhazip.com :"
wget -4 -qO- --timeout=5 http://ipv4.icanhazip.com 2>/dev/null || echo "Échec"

echo -e "\n\n7. ip addr show (IPv4 publique) :"
ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '^172\.' | grep -v '^10\.' | grep -v '^192\.168\.'

echo -e "\n\n8. hostname -I (toutes les IPs) :"
hostname -I

echo -e "\n\nFin des tests"
