import useUrlState from "@ahooksjs/use-url-state";
import CircleIcon from "@mui/icons-material/Circle";
import ErrorIcon from "@mui/icons-material/Error";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import {
  CircularProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router";
import { BrowserRouter } from "react-router-dom";
import { Breakpoint, BreakpointProvider } from "react-socks";
import { SecretNetworkClient, Permit } from 'secretjs';
import "./index.css";
import { balanceFormat, messages as Msgs } from "./Messages";
import { reconnectWallet, WalletButton } from "./WalletStuff";
import { ToastContainer, toast } from "react-toastify";
import MsgHelper from "./MsgHelper";
import "react-toastify/dist/ReactToastify.css";
import { Code } from "./interfaces/code.interface";


ReactDOM.render(
  <BreakpointProvider>
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Typography component="span">
                <App />
              </Typography>
            }
          />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  </BreakpointProvider>,
  document.getElementById("root")
);

type State = {
  [msgIndex: string]: [/* type: */ string, /* input: */ string] | undefined;
};

export default function App() {
  const [secretjs, setSecretjs] = useState<SecretNetworkClient | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [nodeStatus, setNodeStatus] = useState<JSX.Element | string>("");
  const [chainStatus, setChainStatus] = useState<JSX.Element | string>("");
  const [apiUrl, setApiUrl] = useState<string>("https://api.pulsar.scrttestnet.com");
  const [chainId, setChainId] = useState<string>("pulsar-2");
  const [prefix, setPrefix] = useState<string>("secret");
  const [keyStatus, setKeyStatus] = useState<boolean | undefined>(undefined);
  const [keyValue, setKeyValue] = useState<number | undefined>(undefined);
  const [denom, setDenom] = useState<string>("uscrt");
  const [code_mak, setCodeMak] = useState<{
    code: string,
    market_value: number
  }>({
    code: "",
    market_value: 0
  });
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [code, setCode] = useState<undefined | Code>()
  const [value, setValue] = useState(0)
  const [codeMarket, SetCodeMarket] = useState<undefined | string>()

  const [state, setState] = useUrlState<State>(
    {
      "0": ["", ""],
    },
    {
      parseOptions: {
        arrayFormat: "index",
      },
      stringifyOptions: {
        arrayFormat: "index",
      },
    }
  );

  useEffect(() => {
    // superusers don't click around
    reconnectWallet(setSecretjs, setWalletAddress, apiUrl, chainId).catch(
      (_error) => { }
    );
  }, []);

  const refreshNodeStatus = async (
    querySecretjs: SecretNetworkClient,
    showLoading: boolean
  ) => {
    try {
      if (showLoading) {
        setNodeStatus(
          <CircleIcon color={"disabled"} sx={{ fontSize: "small" }} />
        );
        setChainStatus(
          <div style={{ display: "flex", placeItems: "center", gap: "0.5rem" }}>
            <CircularProgress size={"1em"} />
            <span>Loading...</span>
          </div>
        );
      }

      const { block } = await querySecretjs.query.tendermint.getLatestBlock({});
      let minimum_gas_price: string | undefined;
      try {
        ({ minimum_gas_price } = await querySecretjs.query.node.config({}));
      } catch (error) {
        // Bug on must chains - this endpoint isn't connected
      }
      const { params } = await querySecretjs.query.staking.params({});

      setDenom(params!.bond_denom!);

      const chainId = block?.header?.chain_id!;
      const blockHeight = balanceFormat(Number(block?.header?.height));

      let gasPrice: string | undefined;
      if (minimum_gas_price) {
        gasPrice = minimum_gas_price.replace(/0*([a-z]+)$/, "$1");
      }

      const blockTimeAgo = Math.floor(
        (Date.now() - Date.parse(block?.header?.time as string)) / 1000
      );
      let blockTimeAgoString = `${blockTimeAgo}s ago`;
      if (blockTimeAgo <= 0) {
        blockTimeAgoString = "now";
      }

      setChainId(chainId);

      if (secretjs) {
        reconnectWallet(setSecretjs, setWalletAddress, apiUrl, chainId);
      }

      setNodeStatus(
        <CircleIcon color={"success"} sx={{ fontSize: "small" }} />
      );
      setChainStatus(
        <div style={{ display: "flex", placeItems: "center", gap: "1rem" }}>
          <span
            style={{
              display: "flex",
              placeItems: "center",
              gap: "0.3rem",
            }}
          >
            <img src="/scrt.svg" style={{ width: "1.5em", borderRadius: 10 }} />
            <span>
              <Breakpoint large up>
                <strong>Chain:</strong> {chainId}
              </Breakpoint>
              <Breakpoint medium down>
                {chainId}
              </Breakpoint>
            </span>
          </span>
          <Tooltip title={blockTimeAgoString} placement="top">
            <span
              style={{
                display: "flex",
                placeItems: "center",
                gap: "0.3rem",
              }}
            >
              <ViewInArIcon />
              <>
                <Breakpoint large up>
                  <strong>Block:</strong> {blockHeight}
                </Breakpoint>
                <Breakpoint medium down>
                  {blockHeight}
                </Breakpoint>
              </>
            </span>
          </Tooltip>
          {gasPrice && (
            <span
              style={{
                display: "flex",
                placeItems: "center",
                gap: "0.3rem",
              }}
            >
              <LocalGasStationIcon />
              <span>
                <Breakpoint large up>
                  <strong>Gas price:</strong> {gasPrice}
                </Breakpoint>
                <Breakpoint medium down>
                  {gasPrice}
                </Breakpoint>
              </span>
            </span>
          )}
        </div>
      );
    } catch (error) {
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }

      setNodeStatus(<CircleIcon color={"error"} sx={{ fontSize: "small" }} />);
      setChainStatus(
        <div style={{ display: "flex", placeItems: "center", gap: "0.5rem" }}>
          <ErrorIcon />
          <span>Error: {errorMessage}</span>
        </div>
      );
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setApiUrl((apiUrl: any) => {
        const secretjs = new SecretNetworkClient({
          url: apiUrl,
          chainId: "",
        });

        refreshNodeStatus(secretjs, false);

        return apiUrl;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const secretjs = new SecretNetworkClient({
      url: apiUrl,
      chainId: "",
    });

    refreshNodeStatus(secretjs, true);
  }, [apiUrl]);

  useEffect(() => {
    if (!secretjs) {
      return;
    }

    setPrefix(secretjs.address.replace(/^([a-z]+)1.*$/, "$1"));

    Object.keys(state).forEach((msgIndex) => {
      if (!Msgs[state[msgIndex][0]]?.example) {
        return;
      }

      setState((state: { [x: string]: string[]; }) => ({
        [msgIndex]: [
          state[msgIndex][0],
          JSON.stringify(
            Msgs[state[msgIndex][0]].example(
              secretjs,
              JSON.parse(state[msgIndex][1]),
              prefix,
              denom
            ),
            null,
            2
          ),
        ],
      }));
    });
  }, [secretjs]);



  const showToast = (message: string, type: 'error' | 'success') => {
    switch (type) {
      case 'error':
        return toast.error(message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      case 'success':
        return toast.success(message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
    }

  }

  const handleQueryCodeExistence = async (code: string) => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      query: {
        code_exists: {
          code
        }
      },
      sent_funds: [],
    }, 'query_existence')


    if (typeof response === 'string') { showToast(response, 'error') }

    return response
  }


  const handleChangeMarketValue = async (code: string, market_value: number) => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      code: code,
      market_value: market_value,
      sender: walletAddress,
      sent_funds: [],
    }, 'change_market_value_code')

    if (typeof response === 'string') { showToast(response, 'error') }

    showToast('Market value changed', 'success')

    return setPageIndex(0)
  }

  const handleCreateCode = async (code: string, recognition: string) => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      code: code,
      recognition: recognition,
      sender: walletAddress,
      sent_funds: [{ amount: "5000000", denom: "uscrt" }],
    }, 'create_code')
    if (typeof response === 'string') { showToast(response, 'error') }

    return response
  }

  const handleCreatePermit = async () => {
    if (!secretjs) {
      showToast("Please connect wallet first", 'error');
      return null
    }

    let permit = await secretjs.utils.accessControl.permit.sign(
      walletAddress,
      chainId,
      "permit",
      [import.meta.env.VITE_CONTRACT_ADDRESS as string],
      ["owner", "balance"],
      true
    );

    let result = secretjs.utils.accessControl.permit.verify(
      permit,
      walletAddress,
      import.meta.env.VITE_CONTRACT_ADDRESS as string,
      ["owner", "balance"],
    );
    console.log("Verified permit:", result);

    return permit
  }

  const handleQueryRecognition = async () => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    }
    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      code: "PEDRO",
      sent_funds: [],
    }, 'query_recognition')

    if (typeof response === 'string') { showToast(response, 'error') }

    return response
  }

  const handleQueryCode = async (code: string, permit: Permit) => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    } else if (!permit) {
      return showToast("Please create permit first", 'error');
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      permit: permit,
      sender: walletAddress,
      code: code,
      sent_funds: []
    }, 'query_code')

    if (typeof response === 'string') { showToast(response, 'error') }
    return response
  }

  const handleBuyCode = async () => {
    if (!code_mak) {
      return showToast("Please select a code to buy", 'error');
    }

    if (!secretjs) {
      return showToast("Please connect a wallet first", 'error')
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      code: code_mak.code,
      sender: walletAddress,
      sent_funds: [{ amount: String(code_mak.market_value), denom: "uscrt" }],
    }, 'try_buy_the_code') as any

    if (response.code != 0) {
      return showToast(response.raw_log, 'error')
    }

    showToast('Code bought', 'success')
    setPageIndex(0)
  }

  const handleSentPix = async (code: string, amount: number) => {
    if (!secretjs) {
      return showToast("Please connect wallet first", 'error');
    }

    const response = await MsgHelper(secretjs, {
      code_hash: import.meta.env.VITE_CONTRACT_CODE_HASH as string,
      contract_address: import.meta.env.VITE_CONTRACT_ADDRESS as string,
      code: code,
      sender: walletAddress,
      sent_funds: [{ amount: String(amount), denom: "uscrt" }],
    }, 'sent_pix')

    if (typeof response === 'string') { showToast(response, 'error') }

    return response
  }


  const handleSubmtitCreateKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (keyStatus == true || keyStatus == undefined) {
      return showToast("Invalid key", 'error')
    }
    const identity = document.getElementById('identity') as HTMLInputElement;
    const key = document.getElementById('key') as HTMLInputElement;


    const response = await handleCreateCode(key.value, identity.value) as any
    if (response.code !== 0) {
      return showToast("Error creating the code", 'error')
    } else if (response.code == 0) {
      showToast("Code created successfully", 'success')

      return setPageIndex(3)
    }


  }

  const handleSubmitQueryKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!secretjs) {
      return showToast("Please create permit first", 'error')
    }
    const permit = await handleCreatePermit()
    if (!permit) {
      return showToast("Please create permit first", 'error')
    }
    const search_key = document.getElementById('key_search') as HTMLInputElement;
    const response = await handleQueryCode(search_key.value, permit) as any

    setCode(response.code)

  }

  const [pixCode, setPixCode] = useState<null | string>()
  const handleSubmitPrePix = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const key = document.getElementById('key_here') as any

    if (!key.value) {
      return showToast('Please enter a valid key', 'error')
    }

    const response = await handleQueryCodeExistence(key.value) as any

    if (!response) {
      return showToast('Please enter a valid key', 'error')
    }

    if (response.exists) {
      setPixCode(key.value)
      return setPageIndex(5)
    }

    if (!response.exists) {
      return showToast('Not found this key', 'error')
    }
  }

  const handleSubmitPix = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = document.getElementById('value_pix') as HTMLInputElement;

    const response = await handleSentPix(pixCode as string, Number(value.value)) as any


    if (response.code != 0) {
      return showToast('Error sending pix', 'error')
    }

    showToast('Pix sent successfully', 'success')
    return setPageIndex(0)
  }

  const handleSubmitChangePrice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!codeMarket) {
      return showToast('Please select a code to market', 'error')
    }

    const value = document.getElementById('value_sell') as HTMLInputElement;

    const response = await handleChangeMarketValue(codeMarket, Number(value.value)) as any


    if (response.code != 0) {
      return showToast('Error sending pix', 'error')
    }

    showToast('Market value changed successfully', 'success')

    return setPageIndex(1)

  }

  return (
    <><ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored" /><div style={{ padding: "0.5rem" }}>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            minHeight: "3rem",
            gap: "0.5rem",
          }}
        >
          <WalletButton
            secretjs={secretjs}
            setSecretjs={setSecretjs}
            walletAddress={walletAddress}
            setWalletAddress={setWalletAddress}
            url={apiUrl}
            chainId={chainId} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            placeItems: "center",
            placeContent: "center",
            gap: "0.3rem",
          }}
        >
        </div>
        <>
          <div
            style={{
              width: "100%",
              display: "flex",
              placeItems: "center",
              placeContent: "center",
              gap: "1rem",
            }}
          >

            <div
              style={{
                alignItems: 'center',
                width: "100%",
                display: "flex",
                justifyContent: "center",
                maxWidth: "1200px",
                flexDirection: "column",
              }}
            >
              <img style={{
                width: "15%",
                height: "auto",
              }} src="/logo.png" />


              <div style={{
                width: '600px',
                height: '600px',
                marginTop: '5rem',
              }} id="box">
                {
                  secretjs ? (

                    (pageIndex == 0 && <div>
                      <h1 id="title">Welcome</h1>

                      <p id="paragrapg-welcome">
                        Private payment requests. Easy, fast and encrypted.
                      </p>
                      <div id="dataContainer">
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <button onClick={() => setPageIndex(3)} id="view_our_key_account">
                            View your Key
                          </button>
                          <button onClick={() => setPageIndex(1)} id="create_an_key_account">
                            Create an Key
                          </button>

                          <button onClick={() => setPageIndex(4)} id="create_an_key_account">
                            Send a Pix
                          </button>
                          <p id="text-annun-wel">
                            PixSecret is a payment system built for the LATAM industry.
                            Send and receive your <span style={{
                              color: '#FF5924'
                            }}>"pix"</span>.
                          </p>
                        </div>
                      </div>
                    </div> ||
                      pageIndex == 1 &&
                      <div>
                        <h1 id="title">Create your Key</h1>
                        <p id="paragrapg-welcome">
                          Create your key and your identifier to send pix
                        </p>

                        <form onSubmit={handleSubmtitCreateKey} id="form">
                          <div id="form-group">
                            <label htmlFor="key">Enter your new secretpix key</label>
                            <input onChange={async (e) => {
                              const response = await handleQueryCodeExistence(e.target.value) as any
                              setCodeMak(() => {
                                return {
                                  market_value: response.market_value,
                                  code: e.target.value
                                }
                              })
                              if (response) {
                                setKeyStatus(response.exists)
                                setKeyValue(response.market_value)
                              }
                            }} placeholder="Enter your key" type="text" id="key" />

                            <p id="keysts">Key Status: {
                              keyStatus == null ? (
                                <span>
                                </span>
                              ) : (
                                <span style={{
                                  color: keyStatus ? 'red' : '#36FF04'
                                }}>
                                  {keyStatus ? 'In use' : 'Key available'}
                                  <br />
                                  {keyValue ? <span style={{
                                    color: 'white',
                                    fontWeight: 'lighter'
                                  }}>
                                    {' '}<span onClick={() => {
                                      setPageIndex(7)

                                    }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Buy</span> this code for <span style={{ color: 'yellow', fontWeight: 'bold' }}>{keyValue / 1_000_000}</span> SCRT
                                  </span> : (<span style={{}}></span>)}
                                </span>
                              )
                            }</p>

                          </div>
                          <div id="form-group">
                            <label htmlFor="key">Enter your new id</label>
                            <input placeholder="Enter your identity" type="text" id="identity" />
                          </div>
                          <button type="submit" id="create_key">Finish</button>
                        </form>
                      </div>

                      || pageIndex == 3 &&
                      <div>
                        <h1 id="title">View Your Key</h1>

                        <form onSubmit={handleSubmitQueryKey} id="form">
                          <div id="form-group">
                            <label htmlFor="key">Enter your key for search</label>
                            <input placeholder="Enter your key" type="text" id="key_search" />
                          </div>

                          {
                            code && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-start',
                                  flexDirection: 'column',
                                  width: '80%'
                                }}
                              >
                                <p id="code-data-title">
                                  Code {code.code} data
                                </p>
                                <p id="code-data">
                                  Market value of your code: {code.market_value ? code.market_value / 1_000_000 : '0'} SCRT
                                </p>
                                <p id="code-data">
                                  Number of transactions: {code.transactions.length}
                                </p>

                                <p id="code-data">
                                  Amount earned: {
                                    code.transactions.reduce((acc: number, curr: { amount: number; }) => {
                                      return acc + (curr.amount / 1_000_000)
                                    }, 0)
                                  } SCRT
                                </p>

                                <p id="code-data">
                                  Number of partners: {code.partners.length}
                                </p>
                              </div>
                            )
                          }

                          {!code && <button type="submit" id="search_key">Search</button>}

                          {code && <button onClick={() => {
                            setPageIndex(6)
                            SetCodeMarket(code.code)
                          }} type="button" id="sell_button">Sell your code</button>}
                        </form>
                      </div>

                      || pageIndex == 4 &&
                      <div>
                        <h1 id="title">Send a Pix</h1>

                        <form onSubmit={handleSubmitPrePix} id="form">
                          <div id="form-group">
                            <label htmlFor="key">Enter a key for transfer</label>
                            <input placeholder="Enter a key" type="text" id="key_here" />
                          </div>

                          <button type="submit" id="send_pix">Find Code</button>
                        </form>
                      </div>

                      || pageIndex == 5 &&
                      <div>
                        <h1 id="title">Send a Pix</h1>
                        <form onSubmit={handleSubmitPix} id="form">
                          <div id="form-group">
                            <label htmlFor="key">Enter a value</label>
                            <input onChange={(e) => setValue(Number(e.target.value))} placeholder="Enter a value" type="number" id="value_pix" />
                            <p id="code-data">{value == 0 ? 0 : value / 1_000_000} SCRT</p>
                          </div>

                          <button type="submit" id="send_pix">Sent Pix</button>
                        </form>
                      </div>

                      || pageIndex == 6 &&
                      <div>
                        <h1 id="title">Sell your code</h1>

                        <form onSubmit={handleSubmitChangePrice} id="form">
                          <div id="form-group">
                            <label htmlFor="key">Enter a value</label>
                            <input onChange={(e) => setValue(Number(e.target.value))} placeholder="Enter a value" type="number" id="value_sell" />
                            <p id="code-data">{value == 0 ? 0 : value / 1_000_000} SCRT</p>
                          </div>
                          <button type="submit" id="sell_button">Sell your code</button>
                        </form>
                      </div>

                      || pageIndex == 7 &&
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        marginTop: '9rem',
                        alignItems: 'center'
                      }}>
                        <h1 id="title">Buy <span style={{
                          fontWeight: 'bold'
                        }}>{code_mak?.code}</span> code</h1>
                        <h2 style={{
                          color: "white",
                          textAlign: "center",
                          fontWeight: "lighter"
                        }}>for <span style={{
                          color: 'yellow'
                        }}>{code_mak?.market_value / 1_000_000}</span> SCRT</h2>

                        <button onClick={handleBuyCode} id="buy_a_key">Buy</button>
                      </div>
                    )
                  ) : (
                    <div>
                      <h1 id="title">Connect your wallet</h1>

                      <p id="paragrapg-welcome">
                        Please connect your wallet to continue.
                      </p>
                    </div>
                  )
                }
              </div>
            </div>

          </div>
        </>
      </div ></>
  );
}
