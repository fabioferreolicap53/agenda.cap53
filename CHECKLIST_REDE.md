# Lista de VerificaÃ§Ã£o (Checklist) para CorreÃ§Ã£o de Rede

Execute estes passos no Termius um por um para garantir que a correÃ§Ã£o foi aplicada.

## 1. Verificar se o comando MTU foi aplicado (MUITO IMPORTANTE)
Este comando Ã© o que resolve a maioria dos problemas em VPNs e Redes Corporativas.

Copie e cole no terminal:
```bash
sudo iptables -t mangle -L OUTPUT -n | grep TCPMSS
```
**Se nÃ£o aparecer nada**, significa que o comando **nÃ£o foi executado ou nÃ£o funcionou**.
Execute novamente:
```bash
sudo iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

## 2. Recarregar o Caddy
VocÃª editou o arquivo, mas o Caddy precisa carregar a nova configuraÃ§Ã£o.

Copie e cole:
```bash
caddy fmt /etc/caddy/Caddyfile --overwrite
sudo systemctl reload caddy
```
Se der erro no reload, verifique o status:
```bash
sudo systemctl status caddy
```

## 3. Verificar Logs de Erro
Se ainda nÃ£o funcionar, veja o que o Caddy estÃ¡ dizendo:
```bash
sudo journalctl -u caddy --no-pager | tail -n 20
```

## 4. Teste Final (A partir do seu computador com problema)
Abra o navegador e tente acessar:
`https://centraldedados.dev.br/api/health`

- Se abrir um JSON `{"code": 200, "message": "API is healthy."}`: A conexÃ£o estÃ¡ funcionando! O problema pode ser cache do navegador (limpe o cache).
- Se der "Erro de Certificado": A rede da empresa estÃ¡ interceptando a conexÃ£o.
- Se der "Timeout" ou "NÃ£o foi possÃ­vel conectar": O firewall da empresa estÃ¡ bloqueando o IP/Porta completamente.

