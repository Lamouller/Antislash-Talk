#!/bin/bash

echo "📋 Surveillance des logs Storage en temps réel..."
echo "Fais un enregistrement MAINTENANT et regarde les logs ici."
echo ""

ssh debian@37.59.118.101 'docker logs -f --tail 50 antislash-talk-storage 2>&1'


