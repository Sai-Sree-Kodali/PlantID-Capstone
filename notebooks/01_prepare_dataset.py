"""
Dataset Preparation Script
Organizes Medicinal Leaf dataset into train/val/test splits
with proper species name mapping
"""

import os
import shutil
from pathlib import Path
from sklearn.model_selection import train_test_split
import pandas as pd
import numpy as np

# ============= CONFIGURATION =============
DATASET_PATH = r'C:\Users\Sai Sree\Downloads\PlantID-Capstone\data\raw\Medicinal Leaf Dataset\Medicinal Leaf Dataset\Segmented Medicinal Leaf Images'
OUTPUT_PATH = r'C:\Users\Sai Sree\Downloads\PlantID-Capstone\data\processed'
TRAIN_SPLIT = 0.7   # 70% training
VAL_SPLIT = 0.15    # 15% validation
TEST_SPLIT = 0.15   # 15% testing
SEED = 42

def verify_dataset():
    """Check if dataset exists and show structure"""
    if not os.path.exists(DATASET_PATH):
        print(f"❌ ERROR: Dataset not found at: {DATASET_PATH}")
        print(f"   Current directory: {os.getcwd()}")
        print(f"\n📋 Expected structure:")
        print(f"   PlantID-Capstone/")
        print(f"   └── data/")
        print(f"       └── raw/")
        print(f"           └── Medicinal Leaf Dataset/")
        print(f"               └── Medicinal Leaf Dataset/")
        print(f"                   └── Segmented Medicinal Leaf Images/")
        print(f"                       ├── Aloevera/")
        print(f"                       ├── Amla/")
        print(f"                       └── ... (40 species)")
        print(f"\n💡 Fix: Check if dataset is extracted correctly")
        return False
    
    print(f"✅ Dataset found: {DATASET_PATH}")
    return True

def prepare_dataset():
    """Organize dataset into train/val/test splits"""
    
    if not verify_dataset():
        return None
    
    # Create output directories
    print("\n📁 Creating output directories...")
    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(OUTPUT_PATH, split), exist_ok=True)
    
    # Get all species folders
    all_items = os.listdir(DATASET_PATH)
    species_folders = [d for d in all_items 
                      if os.path.isdir(os.path.join(DATASET_PATH, d)) 
                      and not d.startswith('.')]
    
    print(f"\n✅ Found {len(species_folders)} species")
    
    if len(species_folders) == 0:
        print("❌ No species folders found. Check dataset extraction.")
        return None
    
    # Create species mapping with real names
    species_mapping = {}
    metadata = []
    
    total_images = {'train': 0, 'val': 0, 'test': 0}
    
    print("\n🔄 Processing species:")
    print("-" * 60)
    
    for idx, species_name in enumerate(sorted(species_folders)):
        species_mapping[idx] = species_name
        species_path = os.path.join(DATASET_PATH, species_name)
        
        # Get all images for this species
        all_files = os.listdir(species_path)
        images = [f for f in all_files 
                 if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'))]
        
        if len(images) == 0:
            print(f"⚠️  {idx+1:2d}. {species_name:30s} - No images found, skipping")
            continue
        
        print(f"   {idx+1:2d}. {species_name:30s} - {len(images):3d} images", end='')
        
        # Skip if too few images
        if len(images) < 10:
            print(" ⚠️ Too few images, skipping")
            continue
        
        # Split dataset
        if len(images) < 20:
            # For very small classes, use simpler split
            train_imgs = images[:int(len(images)*0.7)]
            val_imgs = images[int(len(images)*0.7):int(len(images)*0.85)]
            test_imgs = images[int(len(images)*0.85):]
        else:
            # Standard stratified split
            train_imgs, temp_imgs = train_test_split(
                images, 
                test_size=(VAL_SPLIT + TEST_SPLIT), 
                random_state=SEED
            )
            if len(temp_imgs) >= 2:
                val_imgs, test_imgs = train_test_split(
                    temp_imgs, 
                    test_size=TEST_SPLIT/(VAL_SPLIT + TEST_SPLIT), 
                    random_state=SEED
                )
            else:
                val_imgs = temp_imgs[:1]
                test_imgs = temp_imgs[1:] if len(temp_imgs) > 1 else []
        
        # Copy files to respective folders
        for split, img_list in [('train', train_imgs), ('val', val_imgs), ('test', test_imgs)]:
            split_species_path = os.path.join(OUTPUT_PATH, split, species_name)
            os.makedirs(split_species_path, exist_ok=True)
            
            for img in img_list:
                src = os.path.join(species_path, img)
                dst = os.path.join(split_species_path, img)
                
                try:
                    shutil.copy2(src, dst)
                    
                    # Record metadata
                    metadata.append({
                        'split': split,
                        'species': species_name,
                        'class_id': idx,
                        'filename': img,
                        'full_path': dst
                    })
                except Exception as e:
                    print(f"\n⚠️ Error copying {img}: {e}")
        
        # Update counters
        total_images['train'] += len(train_imgs)
        total_images['val'] += len(val_imgs)
        total_images['test'] += len(test_imgs)
        
        print(f" → Train:{len(train_imgs):3d} Val:{len(val_imgs):2d} Test:{len(test_imgs):2d}")
    
    print("-" * 60)
    
    # Save species mapping
    mapping_df = pd.DataFrame(list(species_mapping.items()), 
                             columns=['class_id', 'species_name'])
    mapping_path = os.path.join(OUTPUT_PATH, 'species_mapping.csv')
    mapping_df.to_csv(mapping_path, index=False)
    print(f"\n✅ Species mapping saved: {mapping_path}")
    print(f"   Total species: {len(species_mapping)}")
    
    # Save metadata
    metadata_df = pd.DataFrame(metadata)
    metadata_path = os.path.join(OUTPUT_PATH, 'dataset_metadata.csv')
    metadata_df.to_csv(metadata_path, index=False)
    print(f"✅ Metadata saved: {metadata_path}")
    
    # Print summary
    print("\n📊 Dataset Split Summary:")
    print(f"   Training:   {total_images['train']:4d} images ({total_images['train']/sum(total_images.values())*100:.1f}%)")
    print(f"   Validation: {total_images['val']:4d} images ({total_images['val']/sum(total_images.values())*100:.1f}%)")
    print(f"   Testing:    {total_images['test']:4d} images ({total_images['test']/sum(total_images.values())*100:.1f}%)")
    print(f"   TOTAL:      {sum(total_images.values()):4d} images")
    
    # Show class distribution
    print("\n📈 Class Distribution:")
    dist_df = metadata_df.groupby(['split', 'species']).size().unstack(fill_value=0)
    print(dist_df.head(10))
    
    print("\n✅ Dataset preparation complete!")
    print(f"\n📁 Processed dataset location: {OUTPUT_PATH}")
    
    return species_mapping

if __name__ == "__main__":
    print("=" * 60)
    print("  MEDICINAL LEAF DATASET PREPARATION")
    print("=" * 60)
    
    species_mapping = prepare_dataset()
    
    if species_mapping:
        print("\n🎯 Next Steps:")
        print("   1. Run training notebook: 02_train_species_model.ipynb")
        print(f"   2. Check processed data in: {OUTPUT_PATH}")
        print("   3. Verify species_mapping.csv has correct names")
