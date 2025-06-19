# IPFS Image Upload Guide

This guide explains how to upload your images to IPFS for the photo marketplace.

## Option 1: Pinata (Recommended - Easy)

### Step 1: Create Pinata Account
1. Go to [pinata.cloud](https://pinata.cloud)
2. Sign up for a free account
3. Get 1GB of free storage

### Step 2: Prepare Your Images
You need two versions of each image:
- **Preview version**: Blurred/low-res version (publicly visible)
- **Full version**: High-quality original (only visible after purchase)

### Step 3: Upload to Pinata
1. Log into Pinata dashboard
2. Click "Upload" → "File"
3. Upload your preview images first
4. Copy the IPFS hash (starts with `Qm...` or `baf...`)
5. Upload your full-resolution images
6. Copy those IPFS hashes too

### Step 4: Update Your Code
Replace the placeholder hashes in your React app:

```typescript
const PICTURES = [
  {
    id: "1",
    tokenId: 0,
    title: "Boobs",
    priceUSDC: 5,
    previewIpfsHash: "QmYourActualPreviewHash1", // Replace this
    fullIpfsHash: "QmYourActualFullHash1",       // Replace this
  },
  // ... more pictures
];
```

## Option 2: IPFS Desktop (Advanced)

### Step 1: Install IPFS Desktop
1. Download from [ipfs.io](https://ipfs.io/install/)
2. Install and run IPFS Desktop
3. Wait for it to sync with the network

### Step 2: Upload Files
1. Open IPFS Desktop
2. Go to "Files" tab
3. Drag and drop your images
4. Copy the IPFS hashes

### Step 3: Pin Your Files (Important!)
- Pin your files to ensure they stay available
- Use a pinning service like Pinata, Infura, or run your own IPFS node

## Option 3: Command Line (For Developers)

### Install IPFS CLI
```bash
# On macOS
brew install ipfs

# On Ubuntu/Debian
sudo apt install ipfs

# Initialize IPFS
ipfs init
ipfs daemon
```

### Upload Files
```bash
# Upload a single file
ipfs add your-image.jpg

# Upload and pin
ipfs add --pin your-image.jpg

# Get the hash and test
ipfs cat QmYourHashHere > test-download.jpg
```

## Creating Preview Images

You need blurred/low-res versions for previews. Here are some options:

### Using ImageMagick (Command Line)
```bash
# Blur image
convert original.jpg -blur 0x8 preview-blurred.jpg

# Reduce quality and size
convert original.jpg -quality 20 -resize 50% preview-lowres.jpg
```

### Using Photoshop/GIMP
1. Open your original image
2. Apply Gaussian blur (radius 5-10px)
3. Reduce image size to 25-50% of original
4. Export with lower quality settings

### Using Online Tools
- [Photopea](https://photopea.com) (free Photoshop alternative)
- [Canva](https://canva.com)
- [GIMP](https://gimp.org) (free desktop app)

## Testing Your IPFS Setup

### Test IPFS URLs
Once uploaded, test your images using these URLs:

```
https://gateway.pinata.cloud/ipfs/YOUR_HASH
https://ipfs.io/ipfs/YOUR_HASH
https://cloudflare-ipfs.com/ipfs/YOUR_HASH
```

### Verify in Browser
1. Open the IPFS URL in your browser
2. Confirm the image loads correctly
3. Test multiple gateways for reliability

## Smart Contract Integration

### Add Photos to Contract
After deployment, add your photos using the contract's `addPhoto` function:

```solidity
// Example call
addPhoto(
    "QmPreviewHash123...",  // Preview IPFS hash
    "QmFullHash456...",     // Full IPFS hash  
    5000000                 // Price: 5 USDC (6 decimals)
)
```

### Update Deployment Script
Modify `deploy.js` with your actual IPFS hashes:

```javascript
const photos = [
  {
    previewHash: "QmYourActualPreviewHash1",
    fullHash: "QmYourActualFullHash1",
    priceUSDC: ethers.parseUnits("5", 6),
    title: "Your Photo Title"
  },
  // Add more photos...
];
```

## Best Practices

### Image Optimization
- **Preview images**: 500x500px max, heavy blur, low quality
- **Full images**: High resolution, original quality
- Use efficient formats (WebP, JPEG)

### IPFS Reliability
- Use multiple pinning services
- Test with multiple gateways
- Consider IPFS clusters for high availability

### Security
- Never upload the full-resolution images to public folders
- Keep preview images visually obscured
- Test the purchase flow thoroughly

### Performance
- Optimize image sizes for web
- Consider progressive loading
- Implement retry logic for IPFS gateway failures

## Troubleshooting

### Image Won't Load
1. Check if IPFS hash is correct
2. Try different gateways
3. Verify the file was pinned properly
4. Check network connectivity

### Slow Loading
1. Use faster IPFS gateways
2. Implement multiple gateway fallbacks
3. Optimize image sizes
4. Consider CDN integration

### Gateway Issues
The app includes multiple gateway fallbacks:
- Pinata Gateway (fastest for Pinata uploads)
- IPFS.io Gateway (most reliable)
- Cloudflare Gateway (fast global CDN)

## Cost Considerations

### Pinata Pricing
- Free: 1GB storage, 100GB bandwidth/month
- Paid plans start at $20/month for 100GB storage

### IPFS Node Costs
- Running your own node: Server costs (~$10-50/month)
- Bandwidth costs for serving images
- Maintenance and monitoring overhead

## Next Steps

1. **Upload your images** to IPFS using your preferred method
2. **Update the contract** deployment script with real IPFS hashes
3. **Deploy the contract** to Base network
4. **Update your React app** with the contract address and IPFS hashes
5. **Test the complete flow** from preview to purchase to full image access

Remember: The security of your system depends on never exposing the full IPFS hashes publicly - they should only be accessible through the smart contract after purchase!