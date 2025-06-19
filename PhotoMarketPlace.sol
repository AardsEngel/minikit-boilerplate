// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PhotoMarketplace is ERC721, Ownable, ReentrancyGuard {
    IERC20 public immutable usdcToken;
    
    struct Photo {
        string previewIpfsHash;    // Low-res preview (public)
        string fullIpfsHash;       // Full-res image (private)
        uint256 priceUSDC;         // Price in USDC (6 decimals)
        bool isActive;             // Whether photo is available for purchase
        bool isPurchased;          // Track if photo has been purchased
    }
    
    mapping(uint256 => Photo) public photos;
    mapping(uint256 => bool) public photoExists;
    uint256 public nextTokenId;
    
    // Events
    event PhotoAdded(uint256 indexed tokenId, string previewHash, uint256 priceUSDC);
    event PhotoPurchased(uint256 indexed tokenId, address indexed buyer, uint256 priceUSDC);
    event PhotoUpdated(uint256 indexed tokenId, string newPreviewHash, string newFullHash, uint256 newPrice);
    event PhotoDeactivated(uint256 indexed tokenId);
    
    constructor(
        address _usdcToken,
        address initialOwner
    ) ERC721("PhotoMarketplace", "PHOTO") Ownable(initialOwner) {
        usdcToken = IERC20(_usdcToken);
    }
    
    /**
     * @dev Add a new photo to the marketplace
     * @param _previewIpfsHash IPFS hash for the preview/blurred version
     * @param _fullIpfsHash IPFS hash for the full resolution image
     * @param _priceUSDC Price in USDC (with 6 decimals, e.g., 5000000 = 5 USDC)
     */
    function addPhoto(
        string memory _previewIpfsHash,
        string memory _fullIpfsHash,
        uint256 _priceUSDC
    ) external onlyOwner {
        require(bytes(_previewIpfsHash).length > 0, "Preview hash cannot be empty");
        require(bytes(_fullIpfsHash).length > 0, "Full hash cannot be empty");
        require(_priceUSDC > 0, "Price must be greater than 0");
        
        uint256 tokenId = nextTokenId;
        
        photos[tokenId] = Photo({
            previewIpfsHash: _previewIpfsHash,
            fullIpfsHash: _fullIpfsHash,
            priceUSDC: _priceUSDC,
            isActive: true,
            isPurchased: false
        });
        
        photoExists[tokenId] = true;
        nextTokenId++;
        
        emit PhotoAdded(tokenId, _previewIpfsHash, _priceUSDC);
    }
    
    /**
     * @dev Purchase a photo with USDC
     * @param _tokenId The token ID of the photo to purchase
     */
    function purchasePhoto(uint256 _tokenId) external nonReentrant {
        require(photoExists[_tokenId], "Photo does not exist");
        require(photos[_tokenId].isActive, "Photo is not available for purchase");
        require(!photos[_tokenId].isPurchased, "Photo already purchased");
        
        Photo storage photo = photos[_tokenId];
        
        // Transfer USDC from buyer to contract owner
        require(
            usdcToken.transferFrom(msg.sender, owner(), photo.priceUSDC),
            "USDC transfer failed"
        );
        
        // Mark as purchased and mint the NFT to the buyer
        photo.isPurchased = true;
        _safeMint(msg.sender, _tokenId);
        
        emit PhotoPurchased(_tokenId, msg.sender, photo.priceUSDC);
    }
    
    /**
     * @dev Get the full IPFS hash for a photo (only if caller owns it)
     * @param _tokenId The token ID of the photo
     * @return The full IPFS hash
     */
    function getFullImageHash(uint256 _tokenId) external view returns (string memory) {
        require(photoExists[_tokenId], "Photo does not exist");
        require(photos[_tokenId].isPurchased, "Photo not purchased yet");
        require(ownerOf(_tokenId) == msg.sender, "You don't own this photo");
        
        return photos[_tokenId].fullIpfsHash;
    }
    
    /**
     * @dev Get the preview IPFS hash for a photo (public)
     * @param _tokenId The token ID of the photo
     * @return The preview IPFS hash
     */
    function getPreviewImageHash(uint256 _tokenId) external view returns (string memory) {
        require(photoExists[_tokenId], "Photo does not exist");
        return photos[_tokenId].previewIpfsHash;
    }
    
    function getPhotoDetails(uint256 _tokenId) external view returns (
        string memory previewHash,
        uint256 priceUSDC,
        bool isActive,
        bool isPurchased
    ) {
        require(photoExists[_tokenId], "Photo does not exist");
        
        Photo memory photo = photos[_tokenId];
        
        return (photo.previewIpfsHash, photo.priceUSDC, photo.isActive, photo.isPurchased);
    }
    
    /**
     * @dev Update photo details (owner only)
     */
    function updatePhoto(
        uint256 _tokenId,
        string memory _previewIpfsHash,
        string memory _fullIpfsHash,
        uint256 _priceUSDC
    ) external onlyOwner {
        require(photoExists[_tokenId], "Photo does not exist");
        require(!photos[_tokenId].isPurchased, "Photo already purchased, cannot update");
        
        photos[_tokenId].previewIpfsHash = _previewIpfsHash;
        photos[_tokenId].fullIpfsHash = _fullIpfsHash;
        photos[_tokenId].priceUSDC = _priceUSDC;
        
        emit PhotoUpdated(_tokenId, _previewIpfsHash, _fullIpfsHash, _priceUSDC);
    }
    
    /**
     * @dev Deactivate a photo (owner only)
     */
    function deactivatePhoto(uint256 _tokenId) external onlyOwner {
        require(photoExists[_tokenId], "Photo does not exist");
        require(!photos[_tokenId].isPurchased, "Photo already purchased, cannot deactivate");
        
        photos[_tokenId].isActive = false;
        emit PhotoDeactivated(_tokenId);
    }
    
    /**
     * @dev Get total number of photos
     */
    function getTotalPhotos() external view returns (uint256) {
        return nextTokenId;
    }
    
    /**
     * @dev Check if user owns a specific photo
     */
    function userOwnsPhoto(address user, uint256 _tokenId) external view returns (bool) {
        if (!photoExists[_tokenId]) return false;
        if (!photos[_tokenId].isPurchased) return false;
        
        // Use try-catch to safely check ownership
        try this.ownerOf(_tokenId) returns (address tokenOwner) {
            return tokenOwner == user;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Get all photos owned by a user
     */
    function getUserPhotos(address user) external view returns (uint256[] memory) {
        uint256 totalSupply = nextTokenId;
        uint256 userBalance = balanceOf(user);
        
        if (userBalance == 0) {
            return new uint256[](0);
        }
        
        uint256[] memory userTokens = new uint256[](userBalance);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < totalSupply && currentIndex < userBalance; i++) {
            if (photoExists[i] && photos[i].isPurchased) {
                // Use try-catch to safely check ownership
                try this.ownerOf(i) returns (address tokenOwner) {
                    if (tokenOwner == user) {
                        userTokens[currentIndex] = i;
                        currentIndex++;
                    }
                } catch {
                    // Skip this token if ownerOf fails
                    continue;
                }
            }
        }
        
        // If we found fewer tokens than expected, create a properly sized array
        if (currentIndex < userBalance) {
            uint256[] memory trimmedArray = new uint256[](currentIndex);
            for (uint256 j = 0; j < currentIndex; j++) {
                trimmedArray[j] = userTokens[j];
            }
            return trimmedArray;
        }
        
        return userTokens;
    }
    
    /**
     * @dev Emergency withdrawal function (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        if (balance > 0) {
            usdcToken.transfer(owner(), balance);
        }
    }
}