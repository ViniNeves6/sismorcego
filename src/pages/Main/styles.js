// src/pages/Main/styles.js
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pageHC: {
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 64,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
    textAlign: "center",
  },
  tituloHC: {
    color: "#FFD700",
  },

  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8301d6',
    marginBottom: 6,
    marginTop: 14,
  },
  labelHC: {
    color: '#FFD700',
  },

  input: {
    borderWidth: 1,
    borderColor: '#C4C4C4',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFF',
    fontSize: 14,
    marginBottom: 8,
    color: '#000',
  },
  inputHC: {
    backgroundColor: '#000',
    borderColor: '#FFD700',
    color: '#FFD700',
  },
  inputText: {
    color: '#000',
  },
  inputTextHC: {
    color: '#FFD700',
  },
  placeholderText: {
    color: '#999',
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: '#C4C4C4',
    borderRadius: 12,
    backgroundColor: '#FFF',
    marginBottom: 10,
    overflow: 'hidden',
  },
  pickerContainerHC: {
    borderColor: '#FFD700',
    backgroundColor: '#000',
  },
  picker: {
    fontSize: 14,
    minHeight: 48,
    color: '#000',
  },
  pickerHC: {
    color: '#FFD700',
    backgroundColor: '#000',
  },

  sectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8301d6',
    marginTop: 14,
    marginBottom: 6,
  },
  textHC: {
    color: '#FFD700',
  },

  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginVertical: 10,
  },
  mapHC: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },

  inlineRight: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  buttonSmall: {
    width: 150,
    alignSelf: 'flex-end',
  },
  buttonHalf: {
    flex: 1,
    margin: 0,
  },
  latlngRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  latlngCol: {
    width: '48%',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 10,
  },
  imageHC: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
});
