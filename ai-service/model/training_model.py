import os
import json
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


# =========================
# CONFIG
# =========================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_ROOT = os.path.normpath(os.path.join(CURRENT_DIR, "..", "data", "fruits_vege"))

TRAIN_DIR = os.path.join(DATASET_ROOT, "train")
VAL_DIR   = os.path.join(DATASET_ROOT, "validation")

IMG_SIZE = (128, 128)
BATCH_SIZE = 16
SEED = 123

HEAD_EPOCHS = 8
FINETUNE_EPOCHS = 10
UNFREEZE_LAST_N = 20   #20 or 30

for p in [TRAIN_DIR, VAL_DIR]:
    print(p, "->", os.path.exists(p))

train_ds = keras.utils.image_dataset_from_directory(
    TRAIN_DIR,
    label_mode="int",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=True,
    seed=SEED,
)

val_ds = keras.utils.image_dataset_from_directory(
    VAL_DIR,
    label_mode="int",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=False,
)

class_names = train_ds.class_names
num_classes = len(class_names)

print("Classes:", class_names)
print("Number of classes:", num_classes)

AUTOTUNE = tf.data.AUTOTUNE

train_ds = train_ds.cache().prefetch(AUTOTUNE)
val_ds = val_ds.cache().prefetch(AUTOTUNE)

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp")

train_counts = {}
for cls in class_names:
    cls_dir = os.path.join(TRAIN_DIR, cls)
    train_counts[cls] = sum(
        1 for f in os.listdir(cls_dir)
        if f.lower().endswith(IMAGE_EXTS)
    )

print("Train counts by class:")
for k, v in train_counts.items():
    print(f"  {k}: {v}")

total_train = sum(train_counts.values())
class_weight = {
    idx: total_train / (num_classes * train_counts[cls])
    for idx, cls in enumerate(class_names)
}

print("\nClass weight:")
for idx, w in class_weight.items():
    print(f"  {class_names[idx]} ({idx}): {w:.4f}")

data_augmentation = keras.Sequential(
    [
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.08),
        layers.RandomZoom(0.10),
    ],
    name="data_augmentation",
)

# =========================
# MODEL MobileNetV3Small
# =========================
base_model = keras.applications.MobileNetV3Small(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights="imagenet",
    include_preprocessing=True,  
)

base_model.trainable = False

inputs = keras.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.25)(x)
outputs = layers.Dense(num_classes, activation="softmax")(x)

model = keras.Model(inputs, outputs)

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=4,
        restore_best_weights=True,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=2,
        min_lr=1e-6,
    ),
    keras.callbacks.ModelCheckpoint(
        "best_model_phase1.keras",
        monitor="val_accuracy",
        save_best_only=True,
    ),
]

model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=HEAD_EPOCHS,
    class_weight=class_weight,
    callbacks=callbacks,
)

base_model.trainable = True

for layer in base_model.layers[:-UNFREEZE_LAST_N]:
    layer.trainable = False

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-5),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

callbacks_finetune = [
    keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=4,
        restore_best_weights=True,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=2,
        min_lr=1e-7,
    ),
    keras.callbacks.ModelCheckpoint(
        "best_model_finetuned.keras",
        monitor="val_accuracy",
        save_best_only=True,
    ),
]

model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=FINETUNE_EPOCHS,
    class_weight=class_weight,
    callbacks=callbacks_finetune,
)

best_model = keras.models.load_model("best_model_finetuned.keras")

best_model.save("fruit_veg_mobilenetv3small_finetuned.keras")

with open("class_names.json", "w", encoding="utf-8") as f:
    json.dump(class_names, f, ensure_ascii=False)

print("Saved:")
print(" - fruit_veg_mobilenetv3small_finetuned.keras")
print(" - class_names.json")
