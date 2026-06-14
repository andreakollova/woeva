import { Platform } from 'react-native';

export const Fonts = Platform.select({
  ios: {
    regular: 'SFProText-Regular',
    medium: 'SFProText-Medium',
    semibold: 'SFProText-Semibold',
    bold: 'SFProDisplay-Bold',
    extrabold: 'SFProDisplay-Heavy',
  },
  default: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
  },
})!;
