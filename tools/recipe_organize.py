# -*- coding: utf-8 -*-
"""
Created on Mon Jul 13 08:32:22 2026

@author: Scott Greenwood
"""
import os
import glob
import pandas as pd

# ==========================================
# 1. SETUP: CHOOSE FILE SPECIFICATION OPTION
# ==========================================
USE_FOLDER_PATTERN = True  # Set to True to use folder/pattern, False to use manual list

if USE_FOLDER_PATTERN:
    # Option A: Scan a folder for files matching a pattern
    target_folder = r"C:\Users\fig\Downloads"               # Use "." for current folder, or specify path like "C:/MyRecipes"
    file_pattern = "gemini-code-*.txt" # Default pattern to look for
    
    search_path = os.path.join(target_folder, file_pattern)
    file_list = sorted(glob.glob(search_path))
    print(f"🔍 Found {len(file_list)} files matching pattern '{file_pattern}' in '{target_folder}'")
else:
    # Option B: Manual list of files
    file_list = [
        "image1_brunch.txt",
        "image2_sweets.txt",
        "image3_breads.txt",
        "image4_crusts.txt"
    ]

all_dfs = []

# ==========================================
# 2. INTERACTIVE PROCESSING LOOP
# ==========================================
for file_path in file_list:
    if not os.path.exists(file_path):
        print(f"⚠️ File not found: {file_path}. Skipping...")
        continue
        
    print("\n" + "="*50)
    print(f"PROCESSING FILE: {os.path.basename(file_path)}")
    print("="*50)
    
    # --- Robust CSV Loading to Handle Commas in Recipe Names ---
    # Using sep=None and engine='python' lets pandas automatically handle split logic,
    # but to be completely safe against rogue commas, we read the lines and split on the *first* comma.
    try:
        # Read file as raw lines to bypass normal delimiter issues
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        data = []
        # Skip the header line (Page Number, Recipe Name)
        header = lines[0].strip().split(',')
        
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            # Split exactly once at the first comma encountered
            parts = line.split(',', 1)
            if len(parts) == 2:
                page, recipe = parts[0].strip(), parts[1].strip()
                # Clean up any residual wrapping quotes around the recipe name
                recipe = recipe.strip('"').strip("'").replace('\\,', ',')
                data.append([page, recipe])
        
        df = pd.DataFrame(data, columns=['Page Number', 'Recipe Name'])
        
    except Exception as e:
        print(f"❌ Error parsing {file_path}: {e}. Trying fallback standard reader...")
        df = pd.read_csv(file_path) # Fallback just in case
    
    # Display the head of the file in the Spyder console for review
    print("\n--- Here is the head of the file: ---")
    print(df.head(6))
    print("-" * 37)
    
    # Prompt you for the Category
    category = input("Enter the CATEGORY for this file: ").strip()
    
    # Prompt you for optional comma-separated keywords
    keywords_raw = input("Enter KEYWORDS (comma-separated, optional): ").strip()
    # Normalize keywords to a clean, standardized format if provided
    keywords = ", ".join([k.strip() for k in keywords_raw.split(",") if k.strip()]) if keywords_raw else ""
    
    # Add the inputs as new columns to the dataframe
    df['Category'] = category
    df['Keywords'] = keywords
    
    all_dfs.append(df)

# ==========================================
# 3. MERGE, SORT, AND SAVE
# ==========================================
if all_dfs:
    # Combine all individual files into a single DataFrame
    master_df = pd.concat(all_dfs, ignore_index=True)
    
    # Ensure page numbers are treated numerically for correct sorting (e.g., 99 < 100)
    master_df['Page Number'] = pd.to_numeric(master_df['Page Number'], errors='coerce')
    
    # Sort the final dataset cleanly by Page Number
    master_df = master_df.sort_values(by='Page Number').reset_index(drop=True)
    
    # Save the output
    output_filename = "master_recipe_index.csv"
    # index=False ensures we don't save an unnecessary row-number column
    master_df.to_csv(output_filename, index=False)
    
    print("\n" + "#"*50)
    print(f"🎉 SUCCESS! Combined CSV saved as: {output_filename}")
    print("#"*50)
    print(master_df.head(20)) # Shows a preview of the sorted master file
else:
    print("\n❌ No files were successfully processed.")