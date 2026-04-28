import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './supabase';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectUrl = AuthSession.makeRedirectUri();
  console.log('OAuth redirect URL:', redirectUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) return { error };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type === 'success' && result.url) {
    const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      });
      return { error: sessionError };
    }
  }

  return { error: new Error('Sign in cancelled') };
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') return { error: new Error('Apple sign in is iOS only') };

  try {
    const redirectUrl = AuthSession.makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) return { error };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
        return { error: sessionError };
      }
    }

    return { error: new Error('Sign in cancelled') };
  } catch (err: any) {
    return { error: err };
  }
}
