"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown } from "lucide-react"

export function LeverageCalculator() {
  const [leverage, setLeverage] = useState("10")
  const [quantity, setQuantity] = useState("1000")
  const [entryPrice, setEntryPrice] = useState("10")
  const [exitPrice, setExitPrice] = useState("20")
  const [liquidationPrice, setLiquidationPrice] = useState("")
  const [direction, setDirection] = useState<"long" | "short">("long")
  const [initialMargin, setInitialMargin] = useState("")
  const [pnl, setPnl] = useState("")
  const [roe, setRoe] = useState("")

  const formatNumber = (num: number): string => {
    if (!isFinite(num)) return "0"
    return Number(num.toFixed(6)).toString()
  }

  const removeSign = (value: string): number => {
    return Number(value.replace(/\$|\s|,|USDC|%/g, "")) || 0
  }

  const calculate = (type?: "margin" | "pnl" | "roe") => {
    const lev = removeSign(leverage)
    const qty = removeSign(quantity)
    const entry = removeSign(entryPrice)
    const exit = removeSign(exitPrice)

    if (!lev || !entry || !exit) return

    let calcInitialMargin: number
    let calcQuantity = qty
    let calcExitPrice = exit

    // Calculate initial margin
    if (type === "margin") {
      const margin = removeSign(initialMargin)
      calcInitialMargin = margin
      calcQuantity = (margin * lev) / entry
      setQuantity(formatNumber(calcQuantity))
    } else {
      calcInitialMargin = (qty * entry) / lev
      setInitialMargin(formatNumber(calcInitialMargin))
    }

    // Calculate PNL
    let calcPnl: number
    if (type === "pnl") {
      const pnlValue = removeSign(pnl)
      calcPnl = pnlValue
      if (direction === "long") {
        calcExitPrice = pnlValue / calcQuantity + entry
      } else {
        calcExitPrice = entry - pnlValue / calcQuantity
      }
      setExitPrice(formatNumber(calcExitPrice))
    } else {
      if (direction === "long") {
        calcPnl = (exit - entry) * calcQuantity
      } else {
        calcPnl = (entry - exit) * calcQuantity
      }
      setPnl(formatNumber(calcPnl))
    }

    // Calculate ROE
    let calcRoe: number
    if (type === "roe") {
      const roeValue = removeSign(roe)
      calcRoe = roeValue
      calcPnl = (roeValue / 100) * calcInitialMargin
      if (direction === "long") {
        calcExitPrice = calcPnl / calcQuantity + entry
      } else {
        calcExitPrice = entry - calcPnl / calcQuantity
      }
      setExitPrice(formatNumber(calcExitPrice))
      setPnl(formatNumber(calcPnl))
    } else {
      calcRoe = (calcPnl / calcInitialMargin) * 100
      setRoe(formatNumber(calcRoe))
    }

    // Calculate liquidation price
    let liquidation: number
    if (direction === "long") {
      liquidation = entry - entry / lev
    } else {
      liquidation = entry + entry / lev
    }
    setLiquidationPrice(formatNumber(liquidation))
  }

  useEffect(() => {
    if (leverage && quantity && entryPrice && exitPrice) {
      calculate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leverage, quantity, entryPrice, exitPrice, direction])

  const handleMarginChange = () => {
    calculate("margin")
  }

  const handlePnlChange = () => {
    calculate("pnl")
  }

  const handleRoeChange = () => {
    calculate("roe")
  }

  return (
    <div id="mx_cl" className="w-full">
      <style jsx>{`
        #mx_cl *,
        #mx_cl ::after,
        #mx_cl ::before {
          box-sizing: border-box;
        }

        #mx_cl label {
          display: inline-block;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        #mx_cl .form-control {
          display: block;
          width: 100%;
          height: 37px;
          padding: 0.275rem 0.75rem;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #fff;
          background-clip: padding-box;
          border: 1px solid #9f9f9f;
          border-radius: 5px;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        #mx_cl .form-control:focus {
          outline: none;
          border-color: #5a41f5;
          box-shadow: 0 0 0 0.2rem rgba(90, 65, 245, 0.25);
        }

        #mx_cl .full {
          padding: 25px;
          background: #ffffff;
          box-shadow: 0px 0px 28px rgba(0, 0, 0, 0.09);
          border-radius: 8px;
        }

        #mx_cl .headd {
          font-size: 16px;
          font-weight: 400;
          color: #000000;
        }

        #mx_cl .star {
          color: red;
        }

        #mx_cl .sub-title-bottom {
          font-style: italic;
          font-weight: 300;
          font-size: 12px;
          line-height: 15px;
          color: #000000;
          margin-bottom: 20px;
        }

        #mx_cl .bottom-head {
          text-align: center;
          font-size: 18px;
          font-weight: 600;
          color: #000000;
          display: block;
        }

        #mx_cl .bottom-bottom {
          font-style: italic;
          font-weight: 300;
          font-size: 12px;
          line-height: 15px;
          color: #000000;
          margin-top: 15px;
          margin-bottom: 20px;
        }

        #mx_cl .bottom-bottom-top {
          font-style: italic;
          font-weight: 300;
          font-size: 12px;
          line-height: 15px;
          color: #000000;
          margin-bottom: 20px;
          padding-left: 14px;
        }

        #mx_cl .prepend-text {
          font-size: 16px;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 12px;
          padding: 1px 5px;
          border-radius: 5px;
          color: #4a4a4a;
          pointer-events: none;
          z-index: 10;
        }

        #mx_cl .append-text {
          font-size: 16px;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          right: 12px;
          padding: 1px 5px;
          border-radius: 5px;
          color: #4a4a4a;
          pointer-events: none;
          z-index: 10;
        }

        #mx_cl .left-pd {
          padding-left: 35px;
        }

        #mx_cl .option-sec {
          display: flex;
          flex-direction: row;
          gap: 15px;
        }

        #mx_cl .option-item {
          width: 100%;
          border: 1px solid #ccc;
          border-radius: 5px;
          padding: 6px 20px;
          text-align: center;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease-in-out;
        }

        #mx_cl .option-item.arrow-up.is-active {
          background-color: #45e39b;
          border-color: #45e39b;
          color: #fff;
        }

        #mx_cl .option-item.arrow-down.is-active {
          background-color: #ff455b;
          border-color: #ff455b;
          color: #fff;
        }

        #mx_cl .option-item:hover {
          background-color: #ccc;
          color: #fff;
        }

        #mx_cl .head-title h3 {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          border-bottom: 1px solid #5a41f5;
          margin-bottom: 5px;
          padding-bottom: 10px;
        }

        #mx_cl .head-sub-title p {
          text-align: center;
          font-size: 16px;
          font-weight: 400;
          line-height: 19.36px;
          margin-top: 0px;
          padding-bottom: 20px;
        }

        #mx_cl a {
          background: #5a41f5;
          border: 1px solid #5a41f5;
          border-radius: 8px;
          padding: 10px 60px;
          color: #ffffff;
          font-size: 16px;
          text-decoration: none;
          display: inline-block;
          margin-top: 20px;
          transition: background-color 0.15s ease-in-out;
        }

        #mx_cl a:hover {
          background: #4a35d4;
        }

        @media (max-width: 768px) {
          #mx_cl .full {
            padding: 15px;
          }

          #mx_cl a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <div className="full">
        <div className="head-title">
          <h3>Crypto Perpetual Futures Calculator</h3>
        </div>
        <div className="head-sub-title">
          <p>Strategically gauge the leverage potential of your position.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leverage */}
          <div className="form-group">
            <label htmlFor="leverage" className="headd">
              Leverage<span className="star">*</span>
            </label>
            <input
              type="number"
              className="form-control"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              id="leverage"
              autoComplete="off"
            />
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label htmlFor="quantity" className="headd">
              Quantity<span className="star">*</span>
            </label>
            <input
              type="number"
              className="form-control"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              id="quantity"
              autoComplete="off"
            />
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* Entry Price */}
          <div className="form-group relative">
            <label htmlFor="entry_price" className="headd">
              Entry Price<span className="star">*</span>
            </label>
            <div className="relative">
              <span className="prepend-text">$</span>
              <input
                type="number"
                className="form-control left-pd"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                id="entry_price"
                autoComplete="off"
              />
            </div>
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* Exit Price */}
          <div className="form-group relative">
            <label htmlFor="exit_price" className="headd">
              Exit Price<span className="star">*</span>
            </label>
            <div className="relative">
              <span className="prepend-text">$</span>
              <input
                type="number"
                className="form-control left-pd"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                id="exit_price"
                autoComplete="off"
              />
            </div>
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* Liquidation Price */}
          <div className="form-group relative">
            <label htmlFor="liq" className="headd">
              Liquidation Price
            </label>
            <div className="relative">
              <span className="prepend-text">$</span>
              <input
                type="text"
                className="form-control left-pd"
                value={liquidationPrice}
                id="liq"
                readOnly
                autoComplete="off"
              />
            </div>
          </div>

          {/* Direction */}
          <div className="form-group">
            <label className="headd">Direction</label>
            <div className="option-sec">
              <div
                className={`option-item arrow-up ${direction === "long" ? "is-active" : ""}`}
                onClick={() => setDirection("long")}
              >
                <ArrowUp className="w-4 h-4" />
                Long
              </div>
              <div
                className={`option-item arrow-down ${direction === "short" ? "is-active" : ""}`}
                onClick={() => setDirection("short")}
              >
                <ArrowDown className="w-4 h-4" />
                Short
              </div>
            </div>
          </div>
        </div>

        <br />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Initial Margin */}
          <div className="form-group relative">
            <label className="bottom-head" htmlFor="initial_margin">
              Initial Margin
            </label>
            <div className="relative">
              <input
                type="number"
                style={{ paddingRight: "60px" }}
                className="form-control"
                value={initialMargin}
                onChange={(e) => {
                  setInitialMargin(e.target.value)
                  handleMarginChange()
                }}
                id="initial_margin"
                autoComplete="off"
              />
              <span className="append-text">USDC</span>
            </div>
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* PNL */}
          <div className="form-group relative">
            <label className="bottom-head" htmlFor="pnl">
              PNL - Profit and Loss
            </label>
            <div className="relative">
              <input
                type="number"
                style={{ paddingRight: "60px" }}
                className="form-control"
                value={pnl}
                onChange={(e) => {
                  setPnl(e.target.value)
                  handlePnlChange()
                }}
                id="pnl"
                autoComplete="off"
              />
              <span className="append-text">USDC</span>
            </div>
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>

          {/* ROE */}
          <div className="form-group relative">
            <label className="bottom-head" htmlFor="roe">
              ROE - Return on Equity
            </label>
            <div className="relative">
              <input
                type="number"
                style={{ paddingRight: "30px" }}
                className="form-control"
                value={roe}
                onChange={(e) => {
                  setRoe(e.target.value)
                  handleRoeChange()
                }}
                id="roe"
                autoComplete="off"
              />
              <span className="append-text">%</span>
            </div>
            <div className="sub-title-bottom">Only numbers should be used.</div>
          </div>
        </div>

        <div className="bottom-bottom-top" style={{ marginTop: "15px" }}>
          <p>
            Initial margin may not be equal to the actual margin required to place an order. Actual margin required = initial margin + open loss, where open loss reflects the additional cost due to the difference between order price and mark price.
          </p>
        </div>

        <a href="https://dydx.exchange/r/SABZRJKF" target="_blank" rel="noopener noreferrer">
          Trade @ dYdX
        </a>

        <div className="bottom-bottom">
          <p>
            Join to receive a <strong>5% discount</strong> on all trading fees!
          </p>
        </div>
      </div>
    </div>
  )
}

