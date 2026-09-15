const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Staff = require('../models/Staff');
const Quicklist = require('../models/Quicklist');
const Order = require('../models/Order');
const Address = require('../models/Address');

const seedData = async () => {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('[Seed] Connected to MongoDB Atlas successfully.');

    // 1. Seed Users
    console.log('[Seed] Seeding Default Users...');
    await User.deleteMany({});

    const adminUser = await User.create({
      name: 'Dhrub Pandit',
      email: 'dhrub.pandit@draft.io',
      password: 'password123',
      role: 'admin',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArlDY-pODuQ0mKulKnyuEznz8zQ9LDIxteI9Xye8gOSSFKR0AdshbJ69KOfgHjSgg4ummwxchHFUNTtktaAwmujmF-lSLe2G2mCRQPP6BAbKozvZD7GGVp7uvcZxJ667NcyEI-tKYV5avxNTnIey7uKen6ujRCHy2pjzLuiFUbGVkqhNICMl0qkh-SmBh0e8cU3ToYq7fXGQL8iZ_gL6KAZZJaQT2cqDJRPUriuwYzAvZnDSXsYKoraw',
      storeLocation: '',
      accessScope: 'Full System Control • Audit Logs',
      mfaEnabled: true,
      preferences: {
        darkMode: false,
        biometricLogin: true,
        restockNotifications: true,
        displayUnits: 'Metric • Detailed',
      },
    });

    const customerUser = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@storefront.co',
      password: 'password123',
      role: 'member',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: 'System Seed Initializer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkUXt2EeciLJFPeyOtGrTxT-pfq1McBv9BdwS_zmu1jgvpL-VXZFWpO_bxLZ7pRazgpEQL7lhJIBFHxScfTl7inPkk7IWbNPaLxxt6koViB5jF_7gxxwC48kxq0Qi7r9fTfVo_wbGADafHPKEyyAh2HZ5GKiuBFEgaRorcetuShGa7DM4nJLwbHPpXuDA6w1eNdqwm05L-tRnJeepP9-ut0xdzxVKicm-g68UD0pxXpoRokcRMGZzqsg',
      storeLocation: '',
      accessScope: 'Retail Member Hub',
      mfaEnabled: true,
      preferences: {
        darkMode: false,
        biometricLogin: true,
        restockNotifications: true,
        displayUnits: 'Metric • Detailed',
      },
    });

    // 2. Seed Staff Members matching RBAC v2.4 screen
    console.log('[Seed] Seeding Staff Roster...');
    await Staff.deleteMany({});
    const staffMembers = [
      {
        name: 'Sarah Jenkins',
        email: 'sarah.j@draft.io',
        role: 'Super Admin',
        roleKey: 'super_admin',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDM1O2cUGbiFL3CKBxJ-KwN67YJn3xI8KnygYXmtMyTurXpJ5OOObu13fUGQYLe9a_n2gJpAwfqRRNyhh40VD1rPXdHyUTq9Xp8K7NfFU2G9A83USCqyM76sIThqkveB8w9cAE4wlnyi6CZgaUS3JdRkEqWc2x1HUR0XT1OPV2ZwRFNgDZfCL7YvB6fnGF105Nkl2CgnPSMhicQlPi3dSO21zw_4bj-EYhJGybl50JBs1JhM7aoth7NdA',
        accessScope: 'Full System Control • Audit Logs',
        status: 'active',
        lastActive: 'Active Just now',
        mfaVerified: true,
      },
      {
        name: 'Dhrub Pandit',
        email: 'dhrub.p@draft.io',
        role: 'Inventory Lead',
        roleKey: 'inventory_lead',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMUrj_j_jVzhy29C_wQUkWLGlejKIcSd0ND1zWnrZ8Kw_V-fd69wsZqf1zGzFaxc-Ibp_Fl11BCeA8JKfhi2FExyDlBcMPqIb-1VJK-mqgpKpBPsAqHnmhvroptk9FAbk4ynmRLi_sK-X7ipjHs6kBal6YKzsjsDce4jyXJV0mKLGH867kTew5rYw7dezZsJD07uOucItcvF8mFkTuNiTBIyPtFmsYBWrI2UzcqZPxVKXpbCnX1piD1Q',
        accessScope: 'Warehouse Operations & Stock Ledger',
        status: 'active',
        lastActive: 'Active 5m ago',
        mfaVerified: true,
      },
    ];
    await Staff.insertMany(staffMembers);

    // 3. Seed Products matching Stitch UI Exactly
    console.log('[Seed] Seeding Products...');
    await Product.deleteMany({});

    const products = [
      {
        name: 'Aura Studio Wireless Headphones',
        sku: 'AUR-09',
        category: 'Electronics',
        basePrice: 249.00,
        stockQty: 42,
        lowStockThreshold: 10,
        images: [
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ5dVc-WUVokE9Xkr-gUTJW5hzS3u-v45Run1sE881EwS3ZtCjzAeUt1Bk_t0o1vwwOUrnBTW1PvUFajHifHaVItFqfVNlEPjZDQlCufvJfOZ_QgCrGsBT4mFAE8530FccTEfHgcQLNnOxYumSO7VLSXGm-F2lQhumbCafbedYVRGyjmZa4-19xI7xPnF18mHZx0jT_mz_493wuVEWV4_mkuXPxExg7G2RlVtB4kGIhPsrM4nA7g8yqQ',
          'https://lh3.googleusercontent.com/aida-public/AB6AXuA0fke3h69RzGNvHUDRO5roW7d07tsW3jnDSjiHrJFKuddSj8u8sQnHIJibDEJeyZuCFmDELF7yM5IxCK-omS9-yVda36mdpKyOmqqhJrf7tOR_rQiXYRpdS2SjKzMIm2tIrC846RhluuQFiwZ4g6IH3LbITMxO5nQ9pSyP-7S4hIVsXmV3aXhajGbaQtIgG33qope5V0RWWEJLPuwmHe-GKT6KplrLmK5rY6qWrK_iyOeKE0HlhCcQ0g',
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBmQ-X3OJIRtxY-CCkhDTGNcDXkOumkUNpYSaUFzoYKWpBEgVgB-Gko2g0YJTqARWaBfti_5iTel_CqPXLWe_hlvx_tHuYCwdWtXbgpdfA8rDOzu7l5cAl-JUjVvTLnn-8cBMJHMN4Ca8SChpHDTUr2TgNnax6plt1V_n6u1TTwSPtcwmSO84b4gRKyPZA96V8E965XQ-D2MareRHMcym6JCk29kiaf7wLblC81sa8WXGODmPkra54Vmg',
        ],
        coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ5dVc-WUVokE9Xkr-gUTJW5hzS3u-v45Run1sE881EwS3ZtCjzAeUt1Bk_t0o1vwwOUrnBTW1PvUFajHifHaVItFqfVNlEPjZDQlCufvJfOZ_QgCrGsBT4mFAE8530FccTEfHgcQLNnOxYumSO7VLSXGm-F2lQhumbCafbedYVRGyjmZa4-19xI7xPnF18mHZx0jT_mz_493wuVEWV4_mkuXPxExg7G2RlVtB4kGIhPsrM4nA7g8yqQ',
        description: 'Engineered with custom 40mm biocellulose drivers that reproduce spatial sound with crystalline precision. Features hybrid Active Noise Cancellation (ANC) up to -38dB and delivers up to 40 continuous hours of studio-grade playback on a single quick-charge cycle.',
        featured: true,
        specs: [
          { label: 'Connectivity', value: 'Bluetooth 5.3 & 3.5mm Jack' },
          { label: 'Battery Life', value: '40 Hours Active ANC' },
          { label: 'Weight', value: '265g Ultra-lightweight' },
          { label: 'Material', value: 'Anodized Aluminum & Foam' },
          { label: 'Colorway', value: 'Midnight Matte Indigo' },
          { label: 'Warranty', value: '2-Year Protection' },
        ],
      },
      {
        name: 'Ergonomic Matte Mechanical Keyboard',
        sku: 'KB-ERG-88',
        category: 'Workspace',
        basePrice: 129.00,
        stockQty: 18,
        lowStockThreshold: 10,
        images: [
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAHlg0mqirPVm5oAqEhuT4pSiq9x5ccQAcLj_bWzHLGknY5pHrH6mC2fCy6o5lxDimp2K5r3CnjH0Ctmbr5hS4N3LybLGeFxLTOKkSBnLlqExXnxAgTvTk7T35f8VT1-WQNvpw6NavKka6BiKEGXx8sbOp5ewSHx8oIdx1L2Nck_4WG_EvNo1raGInZVJDfdWJwabeNw7lFhl5RC78aweVKHrWNWoiW-CJSf5MD3S47FEpHaSO7cczFSQ',
          'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800',
          'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800',
        ],
        coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHlg0mqirPVm5oAqEhuT4pSiq9x5ccQAcLj_bWzHLGknY5pHrH6mC2fCy6o5lxDimp2K5r3CnjH0Ctmbr5hS4N3LybLGeFxLTOKkSBnLlqExXnxAgTvTk7T35f8VT1-WQNvpw6NavKka6BiKEGXx8sbOp5ewSHx8oIdx1L2Nck_4WG_EvNo1raGInZVJDfdWJwabeNw7lFhl5RC78aweVKHrWNWoiW-CJSf5MD3S47FEpHaSO7cczFSQ',
        description: 'An ergonomic tenkeyless mechanical keyboard featuring matte dark-grey keycaps with subtle warm ambient underglow, engineered for high-performance productivity and gaming precision.',
        featured: false,
        specs: [
          { label: 'Key Switches', value: 'Hot-swappable Custom Linear' },
          { label: 'Form Factor', value: '75% Compact Ergonomic' },
          { label: 'Connectivity', value: 'Tri-Mode 2.4GHz / BT / USB-C' },
          { label: 'Keycaps', value: 'PBT Double-shot Matte' },
        ],
      },
    ];

    const createdProducts = await Product.insertMany(products);

    // 4. Seed Initial Quicklist for Demo Customer
    console.log('[Seed] Seeding Demo Quicklist...');
    await Quicklist.deleteMany({});
    const initialQuicklist = [
      {
        user: customerUser._id,
        product: createdProducts[0]._id, // Aura Headphones
        notifyOnRestock: true,
      },
      {
        user: customerUser._id,
        product: createdProducts[1]._id, // Ergonomic Keyboard
        notifyOnRestock: true,
      },
    ];
    await Quicklist.insertMany(initialQuicklist);

    // 5. Seed Warehouse Hubs & Addresses
    console.log('[Seed] Seeding Warehouse Hubs & Addresses...');
    await Address.deleteMany({});
    const initialHubs = [
      {
        name: 'Distribution Center West (Dock 4)',
        shortName: 'Dock 4, Distribution Center West',
        type: 'PRIMARY RECEIVING BAY',
        street: '1044 Logistics Parkway, Receiving Dock 4',
        cityStateZip: 'Ontario, CA 91761',
        contact: 'Receiving Supervisor • (909) 555-0144',
        hours: 'Mon - Fri: 06:00 - 22:00 PST',
        notes: 'Freight gate code: #4912. Semi-trailer bays 1-6.',
        isPrimary: true,
      },
      {
        name: 'Downtown Flagship Storefront',
        shortName: 'Downtown Flagship Storefront',
        type: 'FLOOR DISPATCH & RECEIVING',
        street: '742 Market Street, Service Entrance (Alley B)',
        cityStateZip: 'San Francisco, CA 94103',
        contact: 'Floor Lead Desk • (415) 555-0198',
        hours: 'Mon - Sun: 08:00 - 21:00 PST',
        notes: 'Box trucks only under 24ft. Ring Bell 2.',
        isPrimary: false,
      },
    ];
    await Address.insertMany(initialHubs);

    // 6. Seed Realistic Orders & Purchase Receipts
    console.log('[Seed] Seeding Purchase Orders & Receipts...');
    await Order.deleteMany({});
    const initialOrders = [
      {
        orderNumber: 'PO-9412',
        dateDisplay: 'Yesterday, 4:15 PM',
        status: 'Delivered',
        statusColor: '#059669',
        statusBg: '#ecfdf5',
        total: '$3,420.00',
        itemCount: 6,
        fulfillment: 'Direct Dispatch • Dock 4',
        deliveryBay: 'DC-West Dock 4',
        tracking: 'FEDEX-7821-9941',
        user: customerUser._id,
        items: [
          { name: 'Industrial 2D Barcode Scanner - Handheld Wireless', qty: 4, price: '$420.00', sku: 'AUR-09' },
          { name: 'Zebra High-Speed Direct Thermal Printhead 300dpi', qty: 2, price: '$870.00', sku: 'KB-ERG-88' },
        ],
      },
      {
        orderNumber: 'PO-9388',
        dateDisplay: 'Sep 8, 2026',
        status: 'Delivered',
        statusColor: '#059669',
        statusBg: '#ecfdf5',
        total: '$890.50',
        itemCount: 20,
        fulfillment: 'Consolidated Courier Delivery',
        deliveryBay: 'Downtown Flagship',
        tracking: 'UPS-1Z992A01824',
        user: customerUser._id,
        items: [
          { name: 'Polyolefin Shrink Film Roll 80 Gauge (18" x 2000\')', qty: 12, price: '$54.00', sku: 'MAT-LTH-01' },
          { name: 'Resin Thermal Transfer Ribbons (Black 110mm)', qty: 8, price: '$30.31', sku: 'STN-441' },
        ],
      },
    ];
    await Order.insertMany(initialOrders);

    console.log('[Seed] Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
