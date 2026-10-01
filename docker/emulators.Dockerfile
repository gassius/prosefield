FROM eclipse-temurin:21-jre-jammy

ARG FIREBASE_TOOLS_VERSION=15.32.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g "firebase-tools@${FIREBASE_TOOLS_VERSION}" \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY docker/emulators-entrypoint.sh /usr/local/bin/emulators-entrypoint.sh
RUN chmod +x /usr/local/bin/emulators-entrypoint.sh

EXPOSE 4000 8080 9099

ENTRYPOINT ["/usr/local/bin/emulators-entrypoint.sh"]
