# Solução Definitiva para Redes Corporativas/VPN (IP 10.9.x.x)

Se o problema persiste especificamente na rede `10.9.x.x`, é quase certo que o **Firewall Corporativo** está bloqueando o protocolo **UDP (HTTP/3)** ou o **MTU (Tamanho do Pacote)** está incorreto.

Siga estes 3 passos na ordem para resolver.

## Passo 1: Forçar TCP (Desativar HTTP/3 no Caddy)
Redes corporativas frequentemente bloqueiam UDP (usado pelo HTTP/3 moderno). Isso faz a conexão falhar silenciosamente ou dar erro "Network Error". Vamos forçar o uso de TCP (HTTP/1.1 e HTTP/2).

1. Edite o Caddyfile:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```

2. Adicione o bloco `servers` no topo do arquivo (antes de qualquer domínio) e mantenha o restante:

   ```caddy
   {
       # Força apenas protocolos TCP (HTTP/1.1 e HTTP/2)
       servers {
           protocols h1 h2
       }
   }

   centraldedados.duckdns.org {
       encode gzip zstd

       # Headers CORS Permissivos (Essencial para acesso externo)
       header {
           Access-Control-Allow-Origin *
           Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
           Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With"
       }

       reverse_proxy 127.0.0.1:8090 {
           header_up Host {host}
           header_up X-Real-IP {remote_host}
           header_up X-Forwarded-For {remote_host}
           header_up X-Forwarded-Proto {scheme}
       }

       tls {
           protocols tls1.2 tls1.3
       }
   }
   ```

3. Recarregue o Caddy:
   ```bash
   sudo systemctl reload caddy
   ```

## Passo 2: Ajustar MTU (MSS Clamping) - CRÍTICO
Se você ainda não executou este comando, **FAÇA AGORA**. Redes VPN/Corporativas descartam pacotes grandes, causando timeouts em conexões HTTPS.

Execute no terminal do servidor:
```bash
sudo iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
sudo netfilter-persistent save
```

## Passo 3: Diagnóstico no Navegador
Se ainda falhar, precisamos saber se é bloqueio de DNS ou Certificado.

1. No computador/dispositivo com erro, abra o navegador.
2. Tente acessar diretamente: `https://centraldedados.duckdns.org/api/health`
   - **Se abrir e mostrar JSON:** O problema é CORS no frontend (verifique o Passo 1).
   - **Se der erro de certificado:** A rede corporativa está interceptando SSL (Proxy). Você precisará instalar o certificado raiz da empresa ou usar HTTP (não recomendado).
   - **Se não carregar (Timeout/Erro de Conexão):** O IP ou Porta 443 está bloqueado pelo Firewall da empresa.

---
**Resumo:** A combinação de **Desativar HTTP/3 (Passo 1)** + **Ajustar MTU (Passo 2)** resolve 99% dos casos em redes corporativas restritivas.
