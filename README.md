# Bhaskara TV - Plataforma de TV Linear

Este projeto implementa uma experiência de TV Linear via web, onde a programação é sincronizada em tempo real com base no horário do servidor (ou do navegador do usuário).

## Como Funciona

1.  **Programação**: Definida no arquivo `schedule.json`.
2.  **Sincronização**: O JavaScript calcula a diferença entre o horário atual e o horário de início do programa.
3.  **Auto-Seek**: Ao carregar, o player pula automaticamente para o ponto exato da transmissão (ex: se o vídeo começou há 10 minutos, ele inicia no minuto 10).
4.  **Autoplay**: Devido às políticas dos navegadores, o vídeo começa mudo. Um overlay central permite que o usuário ative o som com um clique.

## Configuração da Programação

Edite o arquivo `schedule.json`:

```json
{
  "title": "Nome do Programa",
  "url": "http://seu-servidor.com/video.mp4",
  "startTime": "14:00",
  "duration": 60,
  "days": [1, 2, 3, 4, 5] // 0=Dom, 1=Seg, ..., 6=Sáb
}
```

## Requisitos do Servidor de Vídeo

Para que o **Auto-Seek** funcione corretamente, o servidor onde os vídeos estão hospedados deve suportar **Range Requests** (transmissão de bytes). Isso permite que o navegador solicite apenas a parte do vídeo necessária para o momento atual.

Servidores como Nginx, Apache e serviços de storage (AWS S3, Google Cloud Storage) suportam isso nativamente.

## Como Executar

Para testar localmente, você precisa de um servidor web simples para evitar bloqueios de CORS ao carregar o `schedule.json`.

Se você tem Python instalado:
```bash
python3 -m http.server 8000
```
Depois, acesse `http://localhost:8000` no seu navegador.
