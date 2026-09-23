// src/components/Header/styles.js
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    minHeight: 56, // 🔑 altura mínima padrão Material Design
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    zIndex: 50,
    elevation: 6, // sombra Android
    shadowColor: '#000', // sombra iOS
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1, // 🔑 evita quebra em telas pequenas
    textAlign: 'center',
  },
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  // 🔑 estilos extras já prontos para contraste alto
  containerHC: {
    backgroundColor: '#000',
    borderBottomColor: '#FFD700',
  },
  titleHC: {
    color: '#FFD700',
  },
  logoHC: {
    tintColor: '#FFD700',
  },
});
