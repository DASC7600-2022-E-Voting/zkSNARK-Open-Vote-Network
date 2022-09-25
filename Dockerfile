FROM rust:buster
WORKDIR /
RUN git clone https://github.com/iden3/circom.git
RUN cd circom && cargo build --release && cargo install --path circom
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
RUN npm install -g truffle snarkjs ganache-cli
WORKDIR /app
ADD package.json package-lock.json /app/
RUN npm install
CMD bash
