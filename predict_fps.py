import sys
import joblib
import pandas as pd
import json
import warnings
import itertools

warnings.filterwarnings('ignore')

def predict():
    try:
        # 1. Load the V4.5 Brain
        model = joblib.load('fps_predictor_brain.pkl')
        
        args = sys.argv[1:]
        
        # 2. Base Hardware Features from Node.js
        base_features = {
            'CPU_Cores': float(args[0]), 'CPU_Threads': float(args[1]),
            'CPU_Boost_Clock_GHz': float(args[2]), 'CPU_L3_Cache_MB': float(args[3]),
            'GPU_VRAM_GB': float(args[4]), 'GPU_Boost_Clock_MHz': float(args[5]),
            'GPU_Shading_Units': float(args[6]), 'RAM_Capacity_GB': float(args[7]),
            'RAM_Speed_MHz': float(args[8]), 'Dual_Channel': int(args[9]),
            'RAM_Profile_Active': int(args[10]),
            'Upscaling': args[11], 'Frame_Gen': args[12],
            'Game_Engine': args[13], 'DirectX': args[14]
        }

        # 3. Define the UI Scenarios we want the AI to predict
        resolutions = ['1080p', '1440p', '4K UHD']
        presets = ['Low', 'Medium', 'High', 'Ultra']
        
        # 4. Build a DataFrame with all 12 combinations
        rows = []
        for preset, res in itertools.product(presets, resolutions):
            row = base_features.copy()
            row['Graphics_Preset'] = preset
            row['Resolution'] = res
            rows.append(row)
            
        df = pd.DataFrame(rows)
        
        # 5. BATCH PREDICT: AI predicts all 12 scenarios in ~40ms
        predictions = model.predict(df)
        
        # 6. Format the output matrix for React
        matrix = {"Low": {}, "Medium": {}, "High": {}, "Ultra": {}}
        
        for i, (preset, res) in enumerate(itertools.product(presets, resolutions)):
            matrix[preset][res] = {
                "avg": int(predictions[i][0]),
                "lows": int(predictions[i][1])
            }
            
        print(json.dumps(matrix))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()