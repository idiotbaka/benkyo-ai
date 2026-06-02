// Shared item definitions — used by ShopPage and BackpackSheet
import exp2Img from '../assets/icons/item/exp2.png';
import exp3Img from '../assets/icons/item/exp3.png';
import cakeImg from '../assets/icons/item/cake.png';

export const SHOP_ITEMS = [
  {
    id: 'xp2x_15',
    name: '双倍经验卡',
    subtitle: '15 分钟',
    desc: '提供双倍经验 15 分钟',
    icon: '⚡',
    iconImg: exp2Img,
    iconBg: '#FEF9C3',
    color: '#CA8A04',
    badgeBg: 'linear-gradient(135deg, #FEF08A, #FDE047)',
    price: 120,
    multiplier: 2,
  },
  {
    id: 'xp3x_15',
    name: '三倍经验卡',
    subtitle: '15 分钟',
    desc: '提供三倍经验 15 分钟',
    icon: '🚀',
    iconImg: exp3Img,
    iconBg: '#EDE9FE',
    color: '#7C3AED',
    badgeBg: 'linear-gradient(135deg, #C4B5FD, #A78BFA)',
    price: 160,
    multiplier: 3,
  },
  {
    id: 'cake',
    name: '蛋糕',
    subtitle: '',
    desc: '恢复 3 颗心',
    icon: '🎂',
    iconImg: cakeImg,
    iconBg: '#FCE7F3',
    color: '#DB2777',
    badgeBg: 'linear-gradient(135deg, #FBCFE8, #F9A8D4)',
    price: 80,
  },
];
