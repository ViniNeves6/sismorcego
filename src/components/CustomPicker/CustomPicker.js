// Crie um novo arquivo: src/components/CustomPicker/CustomPicker.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform
} from 'react-native';

export default function CustomPicker({
  selectedValue,
  onValueChange,
  items,
  placeholder = "Selecione",
  style,
  textStyle,
  highContrast
}) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem = items.find(item => item.value === selectedValue);
  const displayText = selectedItem ? selectedItem.label : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.pickerButton,
          style,
          highContrast && styles.pickerButtonHC
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[
          styles.pickerButtonText,
          textStyle,
          !selectedValue && styles.placeholderText,
          highContrast && styles.textHC
        ]}>
          {displayText}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, highContrast && styles.modalContentHC]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, highContrast && styles.textHC]}>
                {placeholder}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, highContrast && styles.textHC]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={items}
              keyExtractor={(item) => item.value || item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    item.value === selectedValue && styles.selectedOption,
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    item.value === selectedValue && styles.selectedOptionText,
                    highContrast && styles.textHC
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, highContrast && styles.textHC]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 50,
    justifyContent: 'center',
  },
  pickerButtonHC: {
    borderColor: '#FFD700',
    backgroundColor: '#000',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  textHC: {
    color: '#FFD700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalContentHC: {
    backgroundColor: '#000',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    padding: 8,
  },
  optionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#e6f7ff',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '600',
  },
});
