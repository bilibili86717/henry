// ============================================
// 工序配置文件 —— 后期增加新工序只需在这里添加配置
// 每个工序包含：名称、图标、参数列表、计算公式
// ============================================

const PROCESSES = [
  // ---------- 原片切割 ----------
  {
    id: 'raw-cutting',
    name: '原片切割成本',
    icon: '🔪',
    fields: [
      { id: 'rawPrice', label: '原片平均单价', unit: '元/㎡', default: 80 },
      { id: 'rawLength', label: '原片长度', unit: 'mm', default: 3660 },
      { id: 'rawWidth', label: '原片宽度', unit: 'mm', default: 2440 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product) => {
      const outputWithoutRotation = Math.floor(p.rawLength / product.length) * Math.floor(p.rawWidth / product.width);
      const outputWithRotation = Math.floor(p.rawLength / product.width) * Math.floor(p.rawWidth / product.length);
      const maxOutput = Math.max(outputWithoutRotation, outputWithRotation, 1);
      const rawArea = (p.rawLength * p.rawWidth) / 1000000;
      const rawCost = (p.rawPrice * rawArea) / maxOutput * product.layers;
      const productPerimeter = 2 * (product.length + product.width);
      const cuttingSpeed = 150;
      const cuttingTime = (productPerimeter * product.layers) / cuttingSpeed;
      const productArea = (product.length * product.width) / 1000000;
      const breakingTime = (productArea * product.layers / 9) * 600;
      const totalTime = (cuttingTime + breakingTime) / 3600;
      const laborCost = p.workerNum * 25 * totalTime;
      return {
        cost: rawCost + laborCost,
        detail: { '最大出材数量': maxOutput, '原片成本': rawCost, '切割+掰片时间(h)': totalTime, '人工成本': laborCost }
      };
    }
  },

  // ---------- 磨边 ----------
  {
    id: 'edge-grinding',
    name: '磨边成本',
    icon: '⚙️',
    fields: [
      { id: 'wheelPrice', label: '磨轮单价', unit: '元', default: 260 },
      { id: 'grindableLength', label: '可磨长度', unit: 'm', default: 300 },
      { id: 'grindingSpeed', label: '磨边速度', unit: 'mm/秒', default: 20 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product) => {
      const productPerimeter = 2 * (product.length + product.width);
      const totalGrindingLength = productPerimeter * product.layers;
      const grindingWheelCost = (p.wheelPrice * totalGrindingLength) / (p.grindableLength * 1000);
      const grindingTime = totalGrindingLength / p.grindingSpeed;
      const totalTime = grindingTime / 3600;
      const laborCost = p.workerNum * 25 * totalTime;
      return {
        cost: grindingWheelCost + laborCost,
        detail: { '总磨边长度(mm)': totalGrindingLength.toFixed(0), '磨轮成本': grindingWheelCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 钻孔 ----------
  {
    id: 'drilling',
    name: '钻孔成本',
    icon: '🕳️',
    fields: [
      { id: 'drillBitPrice', label: '钻头价格', unit: '元', default: 80 },
      { id: 'drillableQuantity', label: '可钻数量', unit: '个', default: 300 },
      { id: 'holeCount', label: '孔数', unit: '个', default: 2 },
      { id: 'singleHoleTime', label: '单孔时间', unit: '分钟', default: 2 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p) => {
      if (p.drillableQuantity <= 0) return { cost: 0, detail: { '错误': '可钻孔数量必须大于0' } };
      const drillBitCost = (p.drillBitPrice / p.drillableQuantity) * p.holeCount;
      const totalDrillingTime = (p.singleHoleTime * p.holeCount) / 60;
      const laborCost = p.workerNum * 25 * totalDrillingTime;
      return {
        cost: drillBitCost + laborCost,
        detail: { '钻头成本': drillBitCost, '总钻孔时间(h)': totalDrillingTime, '人工成本': laborCost }
      };
    }
  },

  // ---------- 水刀 ----------
  {
    id: 'waterjet',
    name: '水刀成本',
    icon: '💧',
    fields: [
      { id: 'protectivePaperPrice', label: '保护纸单价', unit: '元/㎡', default: 5 },
      { id: 'waterElectricSandCost', label: '水电砂成本', unit: '元/小时', default: 100 },
      { id: 'cuttingTime', label: '切割时间', unit: '分钟', default: 20 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product) => {
      const productArea = (product.length * product.width * product.layers) / 1000000;
      const protectivePaperCost = productArea * p.protectivePaperPrice;
      const waterElectricSandTotalCost = p.waterElectricSandCost * (p.cuttingTime / 60);
      const laborCost = p.workerNum * 25 * (p.cuttingTime / 60);
      return {
        cost: protectivePaperCost + waterElectricSandTotalCost + laborCost,
        detail: { '产品面积(㎡)': productArea.toFixed(2), '保护纸成本': protectivePaperCost, '水电砂成本': waterElectricSandTotalCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 清洗 ----------
  {
    id: 'cleaning',
    name: '清洗成本',
    icon: '🧼',
    fields: [
      { id: 'workerNum', label: '清洗工人数', unit: '人', default: 1 }
    ],
    calc: (p, product) => {
      const singleProductArea = (product.length * product.width) / 1000000;
      const totalCleaningArea = singleProductArea * product.layers;
      const cleaningTimeHours = (totalCleaningArea * 30) / 3600;
      const laborCost = p.workerNum * 25 * cleaningTimeHours;
      return {
        cost: laborCost,
        detail: { '总清洗面积(㎡)': totalCleaningArea.toFixed(2), '清洗时间(h)': cleaningTimeHours.toFixed(3), '人工成本': laborCost }
      };
    }
  },

  // ---------- 丝印 ----------
  {
    id: 'screen-printing',
    name: '丝印成本',
    icon: '🖨️',
    fields: [
      { id: 'screenPrintingWidth', label: '丝印宽度', unit: 'mm', default: 50 },
      { id: 'inkPrice', label: '油墨单价', unit: '元/平方米', default: 50 },
      { id: 'screenCost', label: '网板费', unit: '元', default: 8 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 4 }
    ],
    calc: (p, product) => {
      const productLengthM = product.length / 1000;
      const productWidthM = product.width / 1000;
      const screenPrintingWidthM = p.screenPrintingWidth / 1000;
      const productPerimeter = 2 * (productLengthM + productWidthM);
      const inkCost = productPerimeter * screenPrintingWidthM * p.inkPrice * product.layers;
      const screenCostPerProduct = p.screenCost / product.quantity;
      const productArea = productLengthM * productWidthM;
      const laborCost = productArea * product.layers * p.workerNum * 2.6;
      return {
        cost: inkCost + screenCostPerProduct + laborCost,
        detail: { '产品周长(m)': productPerimeter.toFixed(2), '油墨成本': inkCost, '网板成本/块': screenCostPerProduct, '人工成本': laborCost }
      };
    }
  },

  // ---------- 热弯 ----------
  {
    id: 'thermal-bending',
    name: '热弯成本',
    icon: '🔥',
    fields: [
      { id: 'thermalBendingTime', label: '热弯时间', unit: '小时', default: 4 },
      { id: 'quantityPerFurnace', label: '每炉数量', unit: '块', default: 1 },
      { id: 'moldPrice', label: '模具价格', unit: '元', default: 2 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product) => {
      const furnaceCost = 130 * p.thermalBendingTime / p.quantityPerFurnace;
      const moldCost = p.moldPrice / product.quantity;
      const laborCost = 25 * p.workerNum * p.thermalBendingTime;
      return {
        cost: furnaceCost + moldCost + laborCost,
        detail: { '炉费用': furnaceCost, '模具成本/块': moldCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 物理钢化 ----------
  {
    id: 'physical-tempering',
    name: '物理钢化成本',
    icon: '🛡️',
    fields: [
      { id: 'temperingTime', label: '钢化时间', unit: '秒', default: 8 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 10 }
    ],
    calc: (p, product) => {
      const maxLength = 2900;
      const maxWidth = 1500;
      const spacing = 200;
      const cols = Math.floor((maxLength + spacing) / (product.length + spacing));
      const rows = Math.floor((maxWidth + spacing) / (product.width + spacing));
      const quantityPerFurnace = Math.max(1, cols * rows);
      const furnaceCost = (480 / 3600) * p.temperingTime / quantityPerFurnace * product.layers;
      const laborCost = 25 * p.workerNum * (p.temperingTime / 3600);
      return {
        cost: furnaceCost + laborCost,
        detail: { '一炉数量': quantityPerFurnace, '物理炉费': furnaceCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 化学钢化 ----------
  {
    id: 'chemical-tempering',
    name: '化学钢化成本',
    icon: '⚗️',
    fields: [
      { id: 'holdingTime', label: '保温时间', unit: '小时', default: 10 },
      { id: 'maxQuantityPerCage', label: '每笼最大数量', unit: '块', default: 50 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product) => {
      const chemicalEnergyCost = p.holdingTime * 272 / p.maxQuantityPerCage * product.layers;
      const laborCost = 25 * p.holdingTime * p.workerNum;
      return {
        cost: chemicalEnergyCost + laborCost,
        detail: { '化学能耗成本': chemicalEnergyCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 合片蒸压 ----------
  {
    id: 'lamination',
    name: '合片蒸压成本',
    icon: '🔗',
    fields: [
      { id: 'normalPrice', label: '普通胶片单价', unit: '元/㎡', default: 50 },
      { id: 'normalLayers', label: '普通层数', unit: '层', default: 1 },
      { id: 'thermalPrice', label: '隔热胶片单价', unit: '元/㎡', default: 125 },
      { id: 'thermalLayers', label: '隔热层数', unit: '层', default: 0 },
      { id: 'splashPrice', label: '飞溅胶片单价', unit: '元/㎡', default: 400 },
      { id: 'splashLayers', label: '飞溅层数', unit: '层', default: 0 },
      { id: 'laminationQuantity8h', label: '8小时合片数量', unit: '块', default: 100 },
      { id: 'quantityPerAutoclave', label: '一釜数量', unit: '块', default: 20 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 20 }
    ],
    calc: (p, product) => {
      const productArea = (product.length / 1000) * (product.width / 1000);
      const filmCost = (p.normalPrice * p.normalLayers + p.thermalPrice * p.thermalLayers + p.splashPrice * p.splashLayers) * productArea;
      const autoclaveCost = 480 / p.quantityPerAutoclave;
      const laborCost = 200 * p.workerNum / p.laminationQuantity8h;
      return {
        cost: filmCost + autoclaveCost + laborCost,
        detail: { '胶片成本': filmCost, '高压釜费用': autoclaveCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 中空 ----------
  {
    id: 'hollow',
    name: '中空成本',
    icon: '🪟',
    fields: [
      { id: 'hollowQuantity8h', label: '8小时合片数量', unit: '块', default: 100 },
      { id: 'hollowLayerWidth', label: '中空层宽度', unit: 'mm', default: 12 },
      { id: 'aluminumStripPrice', label: '铝条单价', unit: '元/米', default: 2 },
      { id: 'hollowGluePrice', label: '胶单价', unit: '元/kg', default: 30 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 8 }
    ],
    calc: (p, product) => {
      const productLengthM = product.length / 1000;
      const productWidthM = product.width / 1000;
      const aluminumStripCost = (productLengthM + productWidthM) * 2 * p.aluminumStripPrice;
      const glueCostHollow = (productLengthM + productWidthM) * 2 * p.hollowLayerWidth * 6 / 1000 / 1000 * 1.24 * p.hollowGluePrice;
      const laborCost = 200 * p.workerNum / p.hollowQuantity8h;
      return {
        cost: aluminumStripCost + glueCostHollow + laborCost,
        detail: { '铝条成本': aluminumStripCost, '胶成本': glueCostHollow, '人工成本': laborCost }
      };
    }
  },

  // ---------- 氩气 ----------
  {
    id: 'argon',
    name: '氩气成本',
    icon: '🌫️',
    fields: [
      { id: 'argonPrice', label: '氩气单价', unit: '元/40L瓶', default: 80 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 2 }
    ],
    calc: (p, product, shared) => {
      const productLengthM = product.length / 1000;
      const productWidthM = product.width / 1000;
      const hollow = shared.hollow || { hollowLayerWidth: 12, hollowQuantity8h: 100 };
      const argonCost = (productLengthM + productWidthM) * 2 * hollow.hollowLayerWidth * 6 / 1000 / 1000 * (p.argonPrice / 40);
      const laborCost = 200 * p.workerNum / hollow.hollowQuantity8h;
      return {
        cost: argonCost + laborCost,
        detail: { '氩气成本': argonCost, '人工成本': laborCost },
        sharedWarning: !shared.hollow ? '依赖中空工序参数（已使用默认值）' : null
      };
    }
  },

  // ---------- 粘接 ----------
  {
    id: 'bonding',
    name: '粘接成本',
    icon: '🧱',
    fields: [
      { id: 'bondingQuantity8h', label: '8小时粘接数量', unit: '块', default: 100 },
      { id: 'bondingAluminumPrice', label: '粘接铝框价格', unit: '元', default: 0 },
      { id: 'bondingHeight', label: '粘接高度', unit: 'mm', default: 15 },
      { id: 'bondingWidth', label: '粘接宽度', unit: 'mm', default: 15 },
      { id: 'bondingGluePrice', label: '胶单价', unit: '元/kg', default: 40 },
      { id: 'primerCapacity', label: '底涂容量', unit: 'ml', default: 250 },
      { id: 'primerPrice', label: '底涂单价', unit: '元/ml', default: 0.7 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 8 }
    ],
    calc: (p, product) => {
      const productLengthM = product.length / 1000;
      const productWidthM = product.width / 1000;
      const glueCostBonding = (productLengthM + productWidthM) * 2 * p.bondingHeight * p.bondingWidth / 1000 / 1000 * 1.24 * p.bondingGluePrice;
      const primerCost = (productLengthM + productWidthM) * 2 * p.bondingHeight * p.bondingWidth / 1000 / 1000 * p.primerCapacity / 1000 * p.primerPrice;
      const laborCost = 200 * p.workerNum / p.bondingQuantity8h;
      return {
        cost: p.bondingAluminumPrice + primerCost + glueCostBonding + laborCost,
        detail: { '铝框成本': p.bondingAluminumPrice, '胶成本': glueCostBonding, '底涂成本': primerCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 贴膜 ----------
  {
    id: 'filming',
    name: '贴膜成本',
    icon: '🎞️',
    fields: [
      { id: 'filmPrice', label: '膜单价', unit: '元/平方米', default: 80 },
      { id: 'filmingQuantity8h', label: '8小时贴膜数量', unit: '块', default: 100 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 8 }
    ],
    calc: (p, product) => {
      const productArea = (product.length / 1000) * (product.width / 1000);
      const filmingCost = productArea * p.filmPrice;
      const laborCost = 200 * p.workerNum / p.filmingQuantity8h;
      return {
        cost: filmingCost + laborCost,
        detail: { '膜成本': filmingCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 包装膜 ----------
  {
    id: 'packing-film',
    name: '包装膜成本',
    icon: '📦',
    fields: [
      { id: 'workerNum', label: '工人数', unit: '人', default: 1 },
      { id: 'packingFilmQuantity1h', label: '1小时包装数量', unit: '块', default: 20 },
      { id: 'packingFilmPrice', label: '包装膜单价', unit: '元/㎡', default: 3 }
    ],
    calc: (p, product) => {
      const productArea = (product.length / 1000) * (product.width / 1000);
      const packingFilmCost = productArea * 2.2 * p.packingFilmPrice;
      const laborCost = 25 * p.workerNum / p.packingFilmQuantity1h;
      return {
        cost: packingFilmCost + laborCost,
        detail: { '包装膜成本': packingFilmCost, '人工成本': laborCost }
      };
    }
  },

  // ---------- 包装箱 ----------
  {
    id: 'packing-box',
    name: '包装箱成本',
    icon: '🗄️',
    fields: [
      { id: 'boxLength', label: '箱子长度', unit: 'mm', default: 1300 },
      { id: 'boxHeight', label: '箱子高度', unit: 'mm', default: 1000 },
      { id: 'boxWidth', label: '箱子宽度', unit: 'mm', default: 400 },
      { id: 'boxProductCount', label: '一箱装几块', unit: '块', default: 4 },
      { id: 'workerNum', label: '工人数', unit: '人', default: 4 },
      { id: 'boxTime', label: '一箱时间', unit: '小时', default: 4 },
      { id: 'boardPrice', label: '板材单价', unit: '元/㎡', default: 45 }
    ],
    calc: (p) => {
      const boxLengthM = p.boxLength / 1000;
      const boxWidthM = p.boxWidth / 1000;
      const boxHeightM = p.boxHeight / 1000;
      const woodBoxCost = ((boxLengthM * boxHeightM) * 2 + (boxLengthM * boxWidthM) * 2 + (boxHeightM * boxWidthM) * 2) * p.boardPrice;
      const laborCost = p.workerNum * p.boxTime * 25;
      const costPerProduct = (woodBoxCost + laborCost) / p.boxProductCount;
      return {
        cost: costPerProduct,
        detail: { '木箱成本': woodBoxCost, '人工成本/箱': laborCost, '每块产品成本': costPerProduct }
      };
    }
  },

  // ---------- 运费 ----------
  {
    id: 'shipping',
    name: '运费成本',
    icon: '🚚',
    fields: [
      { id: 'shippingPrice', label: '运费单价', unit: '元/公斤', default: 2 },
      { id: 'glassThickness', label: '玻璃总厚度', unit: 'mm', default: 10 },
      { id: 'aluminumFrameWeight', label: '铝框重量', unit: '公斤', default: 0 },
      { id: 'filmThickness', label: '胶片总厚度', unit: 'mm', default: 0 }
    ],
    calc: (p, product) => {
      const productLengthM = product.length / 1000;
      const productWidthM = product.width / 1000;
      const glassVolume = productLengthM * productWidthM * (p.glassThickness / 1000);
      const glassWeight = glassVolume * 2500;
      const filmVolume = productLengthM * productWidthM * (p.filmThickness / 1000);
      const filmWeight = filmVolume * 1200;
      const singleWeight = glassWeight + p.aluminumFrameWeight + filmWeight;
      const shippingCost = singleWeight * p.shippingPrice;
      return {
        cost: shippingCost,
        detail: { '玻璃重量(kg)': glassWeight.toFixed(2), '胶片重量(kg)': filmWeight.toFixed(2), '单块总重(kg)': singleWeight.toFixed(2), '运费': shippingCost }
      };
    }
  },

  // ---------- 其他成本（直接填写价格） ----------
  {
    id: 'other',
    name: '其他成本',
    icon: '💰',
    fields: [
      { id: 'otherCost', label: '其他费用', unit: '元/块', default: 0 }
    ],
    calc: (p) => {
      return {
        cost: parseFloat(p.otherCost) || 0,
        detail: { '其他费用': parseFloat(p.otherCost) || 0 }
      };
    }
  }
];

// 配置参数：税率、利润率、人工单价
const CONFIG = {
  taxRate: 0.13,        // 13% 税率
  profitRate: 0.50,     // 50% 利润率
  laborHourlyRate: 25   // 人工单价 25 元/小时
};
