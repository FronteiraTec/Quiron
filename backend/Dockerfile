FROM node:20-alpine

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

# O volume de uploads e escrito em tempo de execucao; sem isto o processo, ja
# sem privilegio, nao conseguiria gravar nele.
RUN mkdir -p /app/uploads && chown -R node:node /app

# Rodar como root dentro do container era o achado QRN-19: qualquer escrita de
# arquivo saia com dono root no volume, e uma falha no processo teria
# privilegio total no namespace.
USER node

EXPOSE 3000

CMD ["npm", "start"]
