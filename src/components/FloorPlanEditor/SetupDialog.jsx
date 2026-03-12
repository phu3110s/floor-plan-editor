import { useState } from "react";
import { SCALE_PRESETS, GRID } from "./constants";
import { pxToReal } from "./utils";

export function SetupDialog({ onStart }) {
  const [widthM,   setWidthM]   = useState(9);
  const [heightM,  setHeightM]  = useState(10);
  const [scaleIdx, setScaleIdx] = useState(2);
  const [floors,   setFloors]   = useState(1);

  const preset  = SCALE_PRESETS[scaleIdx];
  const canvasW = Math.round((widthM  * 1000) / preset.mmPerPx);
  const canvasH = Math.round((heightM * 1000) / preset.mmPerPx);

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gray-900 px-6 py-5">
          <h1 className="text-white font-bold text-lg tracking-tight">Tạo mặt bằng mới</h1>
          <p className="text-gray-400 text-sm mt-1">Nhập kích thước thực tế của ngôi nhà</p>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Width / Height */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Chiều rộng (m)", val: widthM,  set: setWidthM  },
              { label: "Chiều dài (m)",  val: heightM, set: setHeightM },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {label}
                </label>
                <input
                  type="number" min={1} step={0.5} value={val}
                  onChange={(e) => set(+e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 text-xl font-bold rounded-xl px-4 py-3 border-2 border-gray-200 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Floors */}
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              Số tầng
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((f) => (
                <button
                  key={f} onClick={() => setFloors(f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                    floors === f
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              Tỉ lệ bản vẽ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SCALE_PRESETS.map((s, i) => (
                <button
                  key={i} onClick={() => setScaleIdx(i)}
                  className={`px-4 py-3 rounded-xl text-left border-2 transition-all ${
                    scaleIdx === i ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className={`font-bold text-base ${scaleIdx === i ? "text-blue-600" : "text-gray-800"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    1 ô = {GRID * s.mmPerPx >= 1000
                      ? `${((GRID * s.mmPerPx) / 1000).toFixed(1)}m`
                      : `${GRID * s.mmPerPx}mm`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Canvas:{" "}
              <span className="font-mono font-bold text-gray-800">{canvasW} × {canvasH} px</span>
            </div>
            <div className="text-sm text-gray-500">
              Kích thước:{" "}
              <span className="font-bold text-gray-800">{widthM}m × {heightM}m</span>
              <span className="text-gray-400 ml-1 text-xs">(rộng × dài)</span>
            </div>
          </div>

          <button
            onClick={() =>
              onStart({
                widthMm:    widthM  * 1000,
                heightMm:   heightM * 1000,
                mmPerPx:    preset.mmPerPx,
                scaleLabel: preset.label,
                floors,
              })
            }
            className="bg-gray-900 hover:bg-gray-700 text-white font-bold text-base rounded-xl py-3.5 transition-all"
          >
            Bắt đầu thiết kế →
          </button>
        </div>
      </div>
    </div>
  );
}
