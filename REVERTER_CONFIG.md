# Revertendo Configuração do Caddy

Para voltar à configuração original (HTTPS com DuckDNS), você precisa remover o bloco de IP que adicionamos e garantir que o bloco do DuckDNS esteja correto.

## Passo 1: Editar o Caddyfile no Termius

1.  Conecte-se à sua VM pelo Termius.
2.  Abra o arquivo de configuração:
    ```bash
    sudo nano /etc/caddy/Caddyfile
    ```

3.  **Apague** o bloco final que começa com `http://137.131.183.95 { ... }`.

4.  O arquivo deve ficar assim (apenas a parte do DuckDNS):

    ```caddy
    {
        servers {
            protocols h1 h2
        }
    }

    centraldedados.duckdns.org {
        encode gzip zstd
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
    *(Nota: Se você já tinha removido o bloco `header { Access-Control... }` do DuckDNS antes, mantenha sem. Se ele ainda estava lá e funcionando, pode manter. O importante é remover o bloco do IP).*

5.  Salve (`Ctrl + O`, `Enter`) e saia (`Ctrl + X`).

## Passo 2: Recarregar o Caddy

```bash
sudo systemctl reload caddy
```

## Passo 3: Reiniciar Servidor Local

1.  No seu computador, pare o `npm run dev` (`Ctrl+C`).
2.  Rode novamente `npm run dev`.
3.  O login deve voltar a funcionar via `https://centraldedados.duckdns.org`.
