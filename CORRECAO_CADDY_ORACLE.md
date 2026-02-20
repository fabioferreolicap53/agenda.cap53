O problema de acesso via rede móvel com o Caddy na Oracle Cloud geralmente ocorre por duas razões principais: **configuração de HTTPS/TLS** ou **bloqueio de Firewall (Ingress Rules)**.

### Solução Passo a Passo

Para corrigir o erro de acesso via rede móvel, você precisa ajustar a configuração do Caddy na sua VM e verificar as regras de firewall da Oracle Cloud.

#### 1. Atualizar o Caddyfile na VM

Conecte-se via SSH à sua VM na Oracle Cloud e edite o arquivo `Caddyfile` (geralmente em `/etc/caddy/Caddyfile`). Substitua o conteúdo pela configuração abaixo, que é otimizada para PocketBase e resolve problemas de acesso móvel:

```caddy
centraldedados.duckdns.org {
    # Habilita compressão para melhor performance em redes móveis
    encode gzip zstd

    # Proxy reverso para o PocketBase (assumindo porta 8090)
    reverse_proxy 127.0.0.1:8090 {
        # Configurações essenciais para estabilidade
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Headers de segurança recomendados (ajuda em alguns navegadores móveis)
    header {
        # Habilita HSTS (apenas se tiver certeza que sempre usará HTTPS)
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    # Configuração TLS explícita (opcional, mas ajuda se houver problemas de negociação)
    tls {
        # Força protocolos modernos
        protocols tls1.2 tls1.3
    }
}
```

Após editar, recarregue o Caddy:
```bash
sudo systemctl reload caddy
```

#### 2. Verificar Firewall da Oracle Cloud (Security Lists)

Redes móveis muitas vezes usam IPs dinâmicos e protocolos que podem ser bloqueados se as regras não forem permissivas.

1.  Acesse o painel da **Oracle Cloud**.
2.  Vá em **Networking** > **Virtual Cloud Networks**.
3.  Clique na sua VCN e depois em **Security Lists** (geralmente a "Default Security List").
4.  Verifique as **Ingress Rules** (Regras de Entrada). Você deve ter:
    *   **Porta 80 (TCP):** Source `0.0.0.0/0`
    *   **Porta 443 (TCP):** Source `0.0.0.0/0`
    *   **Porta 443 (UDP):** Source `0.0.0.0/0` (Importante! O Caddy tenta usar HTTP/3 via UDP, e redes móveis preferem isso. Se estiver bloqueado, pode causar falha ou lentidão).

**Dica:** Adicione a regra para **UDP na porta 443** se ela não existir.

#### 3. Verificar Firewall Interno da VM (iptables/netfilter)

Na Oracle Cloud, além do painel web, a própria VM tem um firewall (iptables). Execute estes comandos na VM para garantir que as portas estão abertas:

```bash
# Abrir portas HTTP/HTTPS (se usar ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

# Se usar iptables direto (Oracle Linux/Ubuntu padrão)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Resumo Técnico do Problema
O Caddy, por padrão, tenta negociar conexões modernas usando **HTTP/3 (QUIC)** sobre **UDP**. Redes móveis modernas priorizam esse protocolo. Se o Firewall da Oracle (Security List) bloquear UDP na porta 443, a conexão pode falhar ou ficar "pendurada" até dar timeout, resultando no erro de conexão no celular, enquanto no Wi-Fi (que pode forçar TCP/HTTP2) funciona.
