import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  rightLabel?: string;
  onRightLabelPress?: () => void;
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="3" stroke={Colors.gray} strokeWidth={1.8} />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="1" y1="1" x2="23" y2="23" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function Input({ label, error, rightLabel, onRightLabelPress, style, secureTextEntry, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.wrapper}>
      {(label || rightLabel) && (
        <View style={styles.labelRow}>
          {label && <Text style={[styles.label, error && styles.labelError]}>{label}</Text>}
          {rightLabel && (
            <TouchableOpacity onPress={onRightLabelPress}>
              <Text style={styles.rightLabel}>{rightLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            focused && styles.inputFocused,
            error && styles.inputError,
            secureTextEntry && styles.inputWithIcon,
            style,
          ]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={Colors.gray}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} activeOpacity={0.7}>
            <EyeIcon visible={showPassword} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.black,
  },
  labelError: {
    color: Colors.error,
  },
  rightLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.black,
    backgroundColor: Colors.white,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: Colors.black,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
  },
});
