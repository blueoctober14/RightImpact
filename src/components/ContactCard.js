import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const ContactCard = ({ contact, message, onSend }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onSend}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.name}>
                        {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.location}>
                        {contact.city}, {contact.state}
                    </Text>
                </View>
                
                <View style={styles.messageContainer}>
                    <Text style={styles.message}>{message}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    content: {
        flex: 1,
    },
    header: {
        marginBottom: theme.spacing.sm,
    },
    name: {
        fontSize: theme.fontSizes.lg,
        fontWeight: '600',
        color: theme.colors.text,
    },
    location: {
        fontSize: theme.fontSizes.sm,
        color: theme.colors.textSecondary,
    },
    messageContainer: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.sm,
    },
    message: {
        color: theme.colors.background,
        fontSize: theme.fontSizes.md,
    },
});

export default ContactCard;
