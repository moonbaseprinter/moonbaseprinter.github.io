// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuToggle.classList.toggle('active');
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        }
    });
});

// Enhanced counter animation with formatter support
function animateCounter(element, target, duration = 2000, prefix = '', suffix = '', formatter = null) {
    const startText = element.textContent;
    const start = parseFloat(startText.replace(/[^0-9.-]/g, '')) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(timer);
        }
        
        if (formatter) {
            element.textContent = formatter(current);
        } else {
            // Default formatting
            let formattedValue;
            if (target >= 1000000) {
                formattedValue = (current / 1000000).toFixed(2) + 'M';
            } else if (target >= 1000) {
                formattedValue = (current / 1000).toFixed(2) + 'K';
            } else {
                formattedValue = current.toFixed(4);
            }
            element.textContent = prefix + formattedValue + suffix;
        }
    }, 16);
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(4);
}

// Format currency
function formatCurrency(num) {
    return '$' + formatNumber(num);
}

// Live Stats API Integration
const CONTRACT_ADDRESS = '0x70ae9b237c2a86716b713f5fae6a9d045384a66e';
// Base token address (the actual token contract, not the pair address)
const BASE_TOKEN_ADDRESS = '0x2A11eD9626a9Fd300bAB8BBED1592eA072e242Ae';
// Rewards contract address (contains totalDistributed variable)
const REWARDS_CONTRACT_ADDRESS = '0x9356c296659DD665DE0fdcB8fb29d7343A8d5353';
// DexScreener API v1 endpoint for Base chain
const DEXSCREENER_API = `https://api.dexscreener.com/tokens/v1/base/${BASE_TOKEN_ADDRESS}`;
// Base chain RPC endpoint
const BASE_RPC_URL = 'https://mainnet.base.org';

// Update contract address in footer
const contractAddressElement = document.getElementById('contract-address');
if (contractAddressElement) {
    contractAddressElement.textContent = CONTRACT_ADDRESS;
}

// Fetch live stats from DexScreener
async function fetchLiveStats() {
    try {
        console.log('Fetching live stats from DexScreener...', DEXSCREENER_API);
        const response = await fetch(DEXSCREENER_API, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('DexScreener API response:', data);
        
        // The API returns an array directly, not an object with pairs property
        const pairs = Array.isArray(data) ? data : (data.pairs || []);
        
        if (pairs && pairs.length > 0) {
            // Find the pair with the highest liquidity (usually the main trading pair)
            const sortedPairs = pairs.sort((a, b) => {
                const liquidityA = parseFloat(a.liquidity?.usd) || 0;
                const liquidityB = parseFloat(b.liquidity?.usd) || 0;
                return liquidityB - liquidityA;
            });
            
            const pair = sortedPairs[0];
            
            if (!pair) {
                console.warn('No valid pair found');
                useMockData();
                return;
            }
            
            console.log('Using pair:', pair);
            console.log('Pair data:', {
                priceUsd: pair.priceUsd,
                fdv: pair.fdv,
                volume24h: pair.volume?.h24,
                liquidity: pair.liquidity?.usd,
                chainId: pair.chainId,
                chainName: pair.chainName
            });
            
            // Update market cap (use fdv if available, otherwise marketCap)
            const marketCap = parseFloat(pair.fdv) || parseFloat(pair.marketCap) || 0;
            if (marketCap > 0) {
                console.log('Updating market cap:', marketCap);
                updateStat('market-cap', marketCap, formatCurrency);
            } else {
                console.warn('Market cap is 0 or invalid');
            }
            
            // Update 24h volume (volume is in USD already)
            const volume24h = parseFloat(pair.volume?.h24) || 0;
            if (volume24h > 0) {
                console.log('Updating 24h volume:', volume24h);
                // Volume is already in USD, format it
                updateStat('volume-24h', volume24h, (val) => formatCurrency(val));
            }
            
            // Update price (prefer USD price)
            const price = parseFloat(pair.priceUsd) || (pair.priceNative ? parseFloat(pair.priceNative) : 0);
            if (price > 0) {
                console.log('Updating price:', price);
                updateStat('price', price, (val) => {
                    const num = parseFloat(val);
                    if (num < 0.000001) {
                        return '$' + num.toFixed(10);
                    } else if (num < 0.01) {
                        return '$' + num.toFixed(6);
                    } else {
                        return '$' + num.toFixed(4);
                    }
                });
            }
            
            // Update liquidity
            const liquidity = parseFloat(pair.liquidity?.usd) || 0;
            if (liquidity > 0) {
                console.log('Updating liquidity:', liquidity);
                updateStat('liquidity', liquidity, formatCurrency);
            }
            
            // Update transactions (from pair txns if available)
            const txns = pair.txns || {};
            const transactions = (parseInt(txns.m5?.buys) || 0) + (parseInt(txns.m5?.sells) || 0) + 
                                (parseInt(txns.h1?.buys) || 0) + (parseInt(txns.h1?.sells) || 0) + 
                                (parseInt(txns.h6?.buys) || 0) + (parseInt(txns.h6?.sells) || 0) + 
                                (parseInt(txns.h24?.buys) || 0) + (parseInt(txns.h24?.sells) || 0);
            if (transactions > 0) {
                console.log('Updating transactions:', transactions);
                updateStat('transactions', transactions, (val) => formatNumber(val));
            }
            
            // Update chart link
            const chartLink = document.getElementById('chart-link');
            if (chartLink) {
                chartLink.href = pair.url || 'https://dexscreener.com/base/0x70ae9b237c2a86716b713f5fae6a9d045384a66e';
            }
            
            // Update DexScreener link
            const viewDexScreener = document.getElementById('view-dexscreener');
            if (viewDexScreener) {
                viewDexScreener.href = pair.url || 'https://dexscreener.com/base/0x70ae9b237c2a86716b713f5fae6a9d045384a66e';
            }
            
            // Update social links from API response if available, otherwise use defaults
            const followTwitter = document.getElementById('follow-twitter');
            const joinTelegram = document.getElementById('join-telegram');
            
            if (pair.info?.socials) {
                pair.info.socials.forEach(social => {
                    if (social.type === 'twitter' || social.type === 'x') {
                        if (followTwitter) {
                            followTwitter.href = social.url;
                        }
                    } else if (social.type === 'telegram') {
                        if (joinTelegram) {
                            joinTelegram.href = social.url;
                        }
                    }
                });
            } else {
                // Use default links if API doesn't provide socials
                if (followTwitter) {
                    followTwitter.href = 'https://x.com/moonbaseprinter';
                }
                if (joinTelegram) {
                    joinTelegram.href = 'https://t.me/MoonBasePrinter';
                }
            }
            
            // Fetch holders count from Basescan API
            fetchHoldersCount();
            
        } else {
            console.warn('No pairs found in DexScreener response. Response:', data);
            useMockData();
        }
    } catch (error) {
        console.error('API fetch failed:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            apiUrl: DEXSCREENER_API
        });
        useMockData();
    }
}

// Fetch holders count from Basescan API (optional - may require API key)
async function fetchHoldersCount() {
    try {
        // Try to get token info which might include holder count
        // Note: Basescan API may require an API key for some endpoints
        // This is optional and won't break the site if it fails
        const response = await fetch(`https://api.basescan.org/api?module=token&action=tokeninfo&contractaddress=${CONTRACT_ADDRESS}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.status === '1' && data.result && data.result[0]) {
                const tokenInfo = data.result[0];
                // Some token info endpoints include holder count
                // Update if available
                if (tokenInfo.holders) {
                    updateStat('holders', parseInt(tokenInfo.holders), (val) => formatNumber(val));
                }
            }
        }
    } catch (error) {
        // Silently fail - holders count is optional
        console.log('Holders count fetch failed (optional):', error);
    }
}

// Mock data for demonstration (replace with real API calls)
function useMockData() {
    // Mock values - replace with actual API integration
    const mockData = {
        marketCap: 1250000,
        volume24h: 45000,
        price: 0.00125,
        holders: 1250,
        transactions: 8500,
        liquidity: 250000
    };
    
    updateStat('market-cap', mockData.marketCap, formatCurrency);
    updateStat('volume-24h', mockData.volume24h, formatCurrency);
    updateStat('price', mockData.price, (val) => '$' + parseFloat(val).toFixed(6));
    updateStat('holders', mockData.holders, (val) => formatNumber(val));
    updateStat('transactions', mockData.transactions, (val) => formatNumber(val));
    updateStat('liquidity', mockData.liquidity, formatCurrency);
}

// Update stat element with animation
function updateStat(elementId, value, formatter) {
    const element = document.getElementById(elementId);
    if (element) {
        const currentValue = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
        animateCounter(element, value, 1500, '', '', formatter);
    }
}

// Rewards Tracker
let rewardsDistributed = 0;
const rewardsTarget = 10000000; // 10M MOONBASE tokens

// Function to get function selector for a public variable getter
// For uint256 public totalDistributed, the getter is totalDistributed()
function getFunctionSelector(functionName) {
    // Simple keccak256 hash of the function signature (first 4 bytes)
    // totalDistributed() selector: 0x5c60da1b
    const selectors = {
        'totalDistributed()': '0x5c60da1b'
    };
    return selectors[functionName] || null;
}

// Read totalDistributed from smart contract on Base chain
async function fetchTotalDistributed() {
    try {
        console.log('Fetching totalDistributed from contract...', REWARDS_CONTRACT_ADDRESS);
        
        // Function selector for totalDistributed() 
        // This is the first 4 bytes of keccak256("totalDistributed()")
        // If this doesn't work, we may need to calculate it or get it from the contract ABI
        const functionSelector = '0x5c60da1b';
        
        // Try multiple RPC endpoints for reliability
        const rpcEndpoints = [
            'https://mainnet.base.org',
            'https://base.llamarpc.com',
            'https://base.gateway.tenderly.co'
        ];
        
        let lastError = null;
        
        for (const rpcUrl of rpcEndpoints) {
            try {
                // Prepare the RPC call
                const rpcPayload = {
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [
                        {
                            to: REWARDS_CONTRACT_ADDRESS,
                            data: functionSelector
                        },
                        'latest'
                    ],
                    id: 1
                };
                
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(rpcPayload)
                });
                
                if (!response.ok) {
                    throw new Error(`RPC call failed: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error.message || 'RPC error');
                }
                
                if (data.result && data.result !== '0x') {
                    // Convert hex result to BigInt, then to number
                    // Remove '0x' prefix and parse as hex
                    const hexValue = data.result.startsWith('0x') ? data.result.slice(2) : data.result;
                    const totalDistributed = BigInt('0x' + hexValue);
                    
                    console.log('Total distributed (raw):', totalDistributed.toString());
                    
                    // The contract stores totalDistributed as uint256
                    // Convert to number (may lose precision for very large numbers, but should be fine for token amounts)
                    rewardsDistributed = Number(totalDistributed);
                    
                    console.log('Total distributed:', rewardsDistributed);
                    
                    // Update the UI
                    updateRewardsDisplay();
                    
                    return rewardsDistributed;
                }
            } catch (error) {
                console.warn(`RPC endpoint ${rpcUrl} failed:`, error);
                lastError = error;
                continue; // Try next endpoint
            }
        }
        
        // If all RPC endpoints failed, throw the last error
        throw lastError || new Error('All RPC endpoints failed');
        
    } catch (error) {
        console.error('Failed to fetch totalDistributed from RPC:', error);
        console.log('Attempting fallback: Basescan API...');
        
        // Fallback: Try Basescan API (may require API key for some endpoints)
        try {
            const basescanUrl = `https://api.basescan.org/api?module=proxy&action=eth_call&to=${REWARDS_CONTRACT_ADDRESS}&data=0x5c60da1b&tag=latest&apikey=YourApiKeyToken`;
            const response = await fetch(basescanUrl);
            
            if (response.ok) {
                const data = await response.json();
                if (data.result && data.result !== '0x') {
                    const hexValue = data.result.startsWith('0x') ? data.result.slice(2) : data.result;
                    rewardsDistributed = Number(BigInt('0x' + hexValue));
                    console.log('Total distributed (from Basescan):', rewardsDistributed);
                    updateRewardsDisplay();
                    return rewardsDistributed;
                }
            }
        } catch (basescanError) {
            console.error('Basescan fallback also failed:', basescanError);
        }
        
        // If all methods failed, keep previous value or use 0
        console.warn('Using previous rewardsDistributed value or 0');
        updateRewardsDisplay();
        return null;
    }
}

// Update rewards display with current rewardsDistributed value
function updateRewardsDisplay() {
    const rewardsElement = document.getElementById('rewards-distributed');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const avgReward = document.getElementById('avg-reward');
    const holders = parseInt(document.getElementById('holders').textContent.replace(/[^0-9]/g, '')) || 1250;
    
    if (rewardsElement) {
        animateCounter(rewardsElement, rewardsDistributed, 2000, '', '');
    }
    
    if (progressFill && progressPercentage) {
        const percentage = rewardsTarget > 0 ? (rewardsDistributed / rewardsTarget) * 100 : 0;
        progressFill.style.width = Math.min(percentage, 100) + '%';
        progressPercentage.textContent = Math.min(percentage, 100).toFixed(1) + '%';
    }
    
    if (avgReward && holders > 0) {
        const avg = rewardsDistributed / holders;
        avgReward.textContent = formatNumber(avg) + ' $MOONBASE';
    }
    
    // Update last distribution time
    const lastDistribution = document.getElementById('last-distribution');
    if (lastDistribution) {
        const now = new Date();
        lastDistribution.textContent = now.toLocaleString();
    }
    
    // Update next distribution (example: every hour)
    const nextDistribution = document.getElementById('next-distribution');
    if (nextDistribution) {
        const next = new Date(now.getTime() + 60 * 60 * 1000);
        nextDistribution.textContent = next.toLocaleString();
    }
}

function updateRewards() {
    // Fetch from contract instead of using mock data
    fetchTotalDistributed();
}

// Copy Contract Address
const copyButton = document.getElementById('copy-contract');
if (copyButton) {
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(CONTRACT_ADDRESS);
            
            // Visual feedback
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<span class="copy-icon">✓</span>';
            copyButton.style.background = '#00D4FF';
            
            setTimeout(() => {
                copyButton.innerHTML = originalText;
                copyButton.style.background = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = CONTRACT_ADDRESS;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    });
}

// Update community button links (replace with actual URLs)
document.addEventListener('DOMContentLoaded', () => {
    // Update chart link - use pair address
    const chartLink = document.getElementById('chart-link');
    if (chartLink) {
        chartLink.href = 'https://dexscreener.com/base/0x70ae9b237c2a86716b713f5fae6a9d045384a66e';
    }
    
    // Update community links with base token address
    const buyBaseSwap = document.getElementById('buy-baseswap');
    if (buyBaseSwap) {
        buyBaseSwap.href = `https://baseswap.fi/swap?inputCurrency=ETH&outputCurrency=${BASE_TOKEN_ADDRESS}`;
    }
    
    // Update DexScreener link - use pair address
    const viewDexScreener = document.getElementById('view-dexscreener');
    if (viewDexScreener) {
        viewDexScreener.href = 'https://dexscreener.com/base/0x70ae9b237c2a86716b713f5fae6a9d045384a66e';
    }
    
    // Set default social links
    const joinTelegram = document.getElementById('join-telegram');
    if (joinTelegram) {
        joinTelegram.href = 'https://t.me/MoonBasePrinter';
    }
    
    const followTwitter = document.getElementById('follow-twitter');
    if (followTwitter) {
        followTwitter.href = 'https://x.com/moonbaseprinter';
    }
});

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe all cards and sections
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .tokenomics-card, .stat-card, .info-item');
    animatedElements.forEach(el => observer.observe(el));
});

// Auto-refresh stats every 60 seconds
let statsInterval;
let rewardsInterval;
let isInitialized = false;

function startStatsRefresh() {
    // Clear any existing interval
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    // Start new interval (don't call immediately, it's already called on init)
    statsInterval = setInterval(fetchLiveStats, 60000); // 60 seconds
}

function startRewardsRefresh() {
    // Clear any existing interval
    if (rewardsInterval) {
        clearInterval(rewardsInterval);
    }
    // Refresh rewards every 60 seconds
    rewardsInterval = setInterval(fetchTotalDistributed, 60000); // 60 seconds
}

// Initialize on page load
function initializeApp() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('Page loaded, initializing...');
    console.log('Contract Address:', CONTRACT_ADDRESS);
    console.log('DexScreener API URL:', DEXSCREENER_API);
    
    // Initial load
    fetchLiveStats();
    updateRewards(); // This will call fetchTotalDistributed()
    
    // Start auto-refresh (without immediate call)
    startStatsRefresh();
    startRewardsRefresh();
    
    // Animate progress bars on load
    setTimeout(() => {
        const progressBars = document.querySelectorAll('.breakdown-fill, .progress-fill');
        progressBars.forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0%';
            setTimeout(() => {
                bar.style.width = width;
            }, 100);
        });
    }, 500);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    initializeApp();
}

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 30px rgba(0, 82, 255, 0.2)';
    } else {
        navbar.style.boxShadow = '0 2px 20px rgba(0, 82, 255, 0.1)';
    }
    
    lastScroll = currentScroll;
});

