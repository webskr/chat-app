export const AVATARS = {
    male1: require('../assets/avatar/Profile_Male_01.png'),
    male2: require('../assets/avatar/Profile_Male_02.png'),
    male3: require('../assets/avatar/Profile_Male_03.png'),
    female1: require('../assets/avatar/Profile_Female_01.png'),
    female2: require('../assets/avatar/Profile_Female_02.png'),
    female3: require('../assets/avatar/Profile_Female_03.png'),
};

export const getAvatarById = (id: string | number) => {
    const avatars = Object.values(AVATARS);
    const index = typeof id === 'number' ? id : parseInt(id || '0');
    if (isNaN(index)) return avatars[0];
    return avatars[index % avatars.length];
};
