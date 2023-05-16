import { SecretNetworkClient, Wallet } from "secretjs";
import * as fs from "fs";

const wallet = new Wallet(
    "shed clerk spray velvet flower tide cherry idea public solar prize tackle"
);

const secretjs = new SecretNetworkClient({
    chainId: "pulsar-2",
    url: "https://api.pulsar.scrttestnet.com",
    wallet: wallet,
    walletAddress: wallet.address,
});

const contract_wasm = fs.readFileSync("../contract.wasm.gz");

let upload_contract = async () => {
    let tx = await secretjs.tx.compute.storeCode(
        {
            sender: wallet.address,
            wasm_byte_code: contract_wasm,
            source: "",
            builder: "",
        },
        {
            gasLimit: 4_000_000,
        }
    );

    const codeId = Number(
        tx.arrayLog.find((log) => log.type === "message" && log.key === "code_id")
            .value
    );

    console.log("codeId: ", codeId);

    const contractCodeHash = (
        await secretjs.query.compute.codeHashByCodeId({ code_id: codeId })
    ).code_hash;
    console.log(`Contract hash: ${contractCodeHash}`);

    return {
        contract_code_hash: contractCodeHash,
        code_id: codeId
    }
};

let instantiate_contract = async (contract_code_hash, code_id) => {
    const initMsg = {
        count: 0,
        acceptable_tokens: ["uscrt"]
    };
    let tx = await secretjs.tx.compute.instantiateContract(
        {
            code_id: code_id,
            sender: wallet.address,
            code_hash: contract_code_hash,
            init_msg: initMsg,
            label:
                "Secret Pix" +
                Math.ceil(Math.random() * 10000),
        },
        {
            gasLimit: 400_000,
        }
    );

    //Find the contract_address in the logs
    const contractAddress = tx.arrayLog.find(
        (log) => log.type === "message" && log.key === "contract_address"
    ).value;

    console.log("contract address: " +contractAddress);
};

const { contract_code_hash, code_id } = await upload_contract()
await instantiate_contract(contract_code_hash, code_id)

