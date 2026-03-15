import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getBadgeImageSource } from '../constants/badges';

interface ProfileAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  size?: number;
  style?: object;
  textStyle?: object;
  backgroundColor?: string;
  textColor?: string;
}

export default function ProfileAvatar({
  photoURL,
  displayName,
  size = 44,
  style,
  textStyle,
  backgroundColor = '#ccc',
  textColor = '#fff',
}: ProfileAvatarProps) {
  const source = getBadgeImageSource(photoURL);
  const initial = (displayName ?? '?').charAt(0).toUpperCase();
  const radius = size / 2;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius, backgroundColor },
        style,
      ]}
    >
      {source !== null ? (
        typeof source === 'number' ? (
          // Local badge image: scale up to fill the circle, contain to keep aspect ratio
          <Image
            source={source}
            style={[styles.image, { width: size * 1.4, height: size * 1.4 }]}
            resizeMode="contain"
          />
        ) : (
          // Remote URI photo
          <Image
            source={source}
            style={[styles.image, { width: size, height: size, borderRadius: radius }]}
            resizeMode="cover"
          />
        )
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: size * 0.4, color: textColor },
            textStyle,
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
  initial: {
    fontWeight: '700',
  },
});
