# Correção de Duplicidade de CORS

O erro no console (`The 'Access-Control-Allow-Origin' header contains multiple values '*, *'`) indica que tanto o **PocketBase** quanto o **Caddy** estão tentando autorizar o acesso, gerando uma duplicidade que o navegador bloqueia.

Como o PocketBase já faz isso nativamente, precisamos remover a configuração manual do Caddy.

## Passo 1: Editar o Caddyfile no Termius

1.  Conecte-se à sua VM pelo Termius.
2.  Abra o arquivo de configuração:
    ```bash
    sudo nano /etc/caddy/Caddyfile
    ```

3.  Localize o bloco do IP (`http://137.131.183.95`) que adicionamos anteriormente.
    Ele deve estar parecido com isso:

    ```caddy
    http://137.131.183.95 {
        reverse_proxy 127.0.0.1:8090
        header {   <-- REMOVER ESTA LINHA
            Access-Control-Allow-Origin *  <-- REMOVER ESTA LINHA
            Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"  <-- REMOVER ESTA LINHA
            Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With"  <-- REMOVER ESTA LINHA
        }  <-- REMOVER ESTA LINHA
    }
    ```

4.  **Apague** toda a seção `header { ... }`, deixando o bloco apenas assim:

    ```caddy
    http://137.131.183.95 {
        reverse_proxy 127.0.0.1:8090
    }
    ```

5.  Salve o arquivo:
    *   Pressione `Ctrl + O` e `Enter`.
    *   Pressione `Ctrl + X` para sair.

## Passo 2: Recarregar o Caddy

Execute o comando para aplicar a mudança:

```bash
sudo systemctl reload caddy
```

## Passo 3: Testar

1.  Reinicie seu servidor local (`npm run dev`).
2.  Tente fazer login novamente.
