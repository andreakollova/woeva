import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  rightLabel?: string;
  onRightLabelPress?: () => void;
}

export function Input({ label, error, rightLabel, onRightLabelPress, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

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
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={Colors.gray}
        {...props}
      />
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
    fontSize: 14,
    color: Colors.gray,
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
