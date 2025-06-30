import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const ContactItem = ({ contact, isSelected, onSelect }) => {
    return (
        <TouchableOpacity
            style={[
                styles.container,
                isSelected && styles.selected,
            ]}
            onPress={() => onSelect(contact)}
        >
            <View style={styles.content}>
                <Text style={styles.name}>
                    {contact.firstName} {contact.lastName}
                </Text>
                <Text style={styles.email}>
                    {contact.email}
                </Text>
                {contact.phone && (
                    <Text style={styles.phone}>
                        {contact.phone}
                    </Text>
                )}
            </View>
            {isSelected && (
                <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    selected: {
        backgroundColor: theme.colors.primary,
    },
    content: {
        flex: 1,
    },
    name: {
        fontSize: theme.fontSizes.md,
        fontWeight: '600',
        color: theme.colors.text,
    },
    email: {
        fontSize: theme.fontSizes.sm,
        color: theme.colors.textSecondary,
    },
    phone: {
        fontSize: theme.fontSizes.sm,
        color: theme.colors.textSecondary,
    },
    checkmark: {
        width: theme.spacing.lg,
        height: theme.spacing.lg,
        borderRadius: theme.spacing.lg / 2,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmarkText: {
        color: theme.colors.primary,
        fontSize: theme.fontSizes.lg,
    },
});

export default ContactItem;
