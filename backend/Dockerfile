FROM node:20-alpine

# O ffmpeg do lote noturno das reunioes: junta os pedacos de audio gravados no
# navegador, normaliza e recorta antes da transcricao (src/reunioes/
# audioConversor.js). Mesma imagem para a API e para o `processamento`, que so
# troca o comando — uma terceira imagem no deploy custaria mais que estes MB.
RUN apk add --no-cache ffmpeg

WORKDIR /app

# `npm ci` e nao `npm install`: o ci obedece ao package-lock.json e falha se o
# lock estiver fora de sincronia com o package.json. O install ignora o lock e
# resolve versoes de novo — a imagem que a CI testou e a que vai para producao
# poderiam sair com dependencias diferentes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# O commit desta imagem, devolvido pelo /health. O deploy.yml passa o SHA; num
# build local fica "local".
ARG VERSAO=local
ENV VERSAO=$VERSAO

# Os volumes de uploads e de audio sao escritos em tempo de execucao; sem isto
# o processo, ja sem privilegio, nao conseguiria gravar neles.
RUN mkdir -p /app/uploads /app/audio && chown -R node:node /app

# Rodar como root dentro do container era o achado QRN-19: qualquer escrita de
# arquivo saia com dono root no volume, e uma falha no processo teria
# privilegio total no namespace.
USER node

EXPOSE 3000

CMD ["npm", "start"]
